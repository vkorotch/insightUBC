import Log from "../Util";
import JSZip = require('jszip');
import fs = require('fs');
import path = require('path');
let parse5 = require('parse5');
import {ASTNode} from 'parse5';
import {ASTAttribute} from 'parse5';
let restify = require("restify");


/**
 * In-memory representation of all datasets.
 */
export interface Datasets {
    [id: string]: {};
}

export interface GeoResponse{
    lat?: number;
    lon?: number;
    error?: string;
}

export class Result {
    dept: string;
    id: string;
    avg: number;
    instructor: string;
    title: string;
    pass: number;
    fail: number;
    attended: number;
    audit: number;
    uuid: string;
    year: number;

    constructor(dept: string, id: string, avg: number, instructor: string, title: string, pass: number, fail: number, audit: number, uuid: string, year: number) {
        this.dept = dept;
        this.id = id;
        this.avg = avg;
        this.instructor = instructor;
        this.title = title;
        this.pass = pass;
        this.fail = fail;
        this.attended = pass + fail;
        this.audit = audit;
        this.uuid = uuid;
        this.year = year;
    }
}

export class Room {
    fullname: string;
    shortname: string;
    number: string;
    name: string;
    address: string;
    lat: number;
    lon: number;
    seats: number;
    type: string;
    furniture: string;
    href: string;

    constructor(fullname: string, shortname: string, number: string, name: string, address: string, lat: number, lon: number,
    seats: number, type: string, furniture: string, href: string){
        this.fullname = fullname;
        this.shortname = shortname;
        this.number = number;
        this.name = name;
        this.address = address;
        this.lat = lat;
        this.lon = lon;
        this.seats = seats;
        this.type = type;
        this.furniture = furniture;
        this.href = href;
    }
}

export default class DatasetController {

    private datasets: Datasets = {};
    private courseResults = new Array<Result>();
    private rooms = new Array<Room>();

    constructor() {
        Log.trace('DatasetController::init()');
    }
    /**
     * Returns the referenced dataset. If the dataset is not in memory, it should be
     * loaded from disk and put in memory. If it is not in disk, then it should return
     * null.
     *
     * @param id
     * @returns {{}}
     */
    public getDataset(id: string): any {
        //if dataset is not in memory already
        // TODO: this should check if the dataset is on disk in ./data if it is not already in memory.
        let that = this;
        if (that.datasets[id] === null) {
            // check if the dataset is on disk in ./data
            try {
                var datafile = fs.readFileSync(path.join(__dirname, "/data/" + id));
                var jsonObject = JSON.parse(datafile.toString());
                that.datasets[id] = jsonObject;
                return that.datasets[id];
            }
            catch (err) {
                return null;
            }
        } else {
            return that.datasets[id];
        }
    }

    public getDatasets(): Datasets {
        // TODO: if datasets is empty, load all dataset files in ./data from disk
        let that = this;
        if (Object.keys(that.datasets).length == 0) {
            var files: any;
            try {
                files = fs.readdirSync(path.join(__dirname,"/data/"));
            } catch (err) {
                return null;
            }

            for (var file of files) {
                if(file.indexOf(".") !== 0) {
                    try {
                        var filePath = path.join(__dirname,"/data/" + file);
                        Log.trace(filePath);
                        var datafile = fs.readFileSync(filePath);
                        var jsonObject = JSON.parse(datafile.toString());
                        that.datasets[file] = jsonObject;
                    }
                    catch (err) {
                        Log.trace(err);
                        return null;
                    }
                }
            }
        }
        return that.datasets;
    }

    /**
     * Process the dataset; save it to disk when complete.
     *
     * @param id
     * @param data base64 representation of a zip file
     * @returns {Promise<number>} returns 201 or 204 if successful; 400 if the dataset was invalid (for whatever reason)
     */
    public process(id: string, data: any): Promise<number> {
        Log.trace('DatasetController::process( ' + id + '... )');

        let that = this;
        return new Promise(function (fulfill, reject) {
            try {
                let myZip = new JSZip();
                myZip.loadAsync(data, {base64: true}).then(function (zip: JSZip) {
                    Log.trace('DatasetController::process(..) - unzipped');
                    let processedDataset = {};

                    if (id == "courses"){
                        var i = 0;
                        var lengthOfZip = zip.filter(function () {return true}).length;
                        zip.forEach(function (relativePath, file)
                        {
                            file.async("string").then(function (resolve)
                            {
                                i++;
                                if (i == 1 && !file.dir) {
                                    Log.trace("DatasetController::process(..) - ERROR: The zip file does not contain a valid dataset");
                                    reject(new Error("The zip file does not contain a valid dataset"));
                                } else {
                                    var jsonObject = JSON.parse(resolve);

                                    for (var objectKey of Object.keys(jsonObject))
                                    {
                                        if (objectKey == "result") {
                                            for (var result of jsonObject.result) {
                                                var year = 1900;
                                                if (result.Section != "overall") {
                                                    year = parseInt(result.Year);
                                                }
                                                var courseResult = new Result(result.Subject,
                                                                              result.Course,
                                                                              result.Avg,
                                                                              result.Professor,
                                                                              result.Title,
                                                                              result.Pass,
                                                                              result.Fail,
                                                                              result.Audit,
                                                                              result.id.toString(),
                                                                              year);

                                                that.courseResults.push(courseResult);
                                            }
                                        }
                                    }

                                    if (i == lengthOfZip) {
                                        var saved = that.save(id, that.courseResults);
                                        that.courseResults = new Array<any>();
                                        fulfill(saved);
                                    }
                                }
                            });
                        });
                    } else if (id == "rooms"){

                        let indexFile = zip.file("index.htm");
                        var roomLinks = new Array<string>();
                        if (indexFile == null || indexFile == undefined) {
                            Log.trace("DatasetController::process(..) - ERROR: The zip file does not contain a valid dataset");
                            reject(new Error("The zip file does not contain a valid dataset"));
                        } else {
                            indexFile.async("string").then(function (resolve) {
                                var htmlTrace = ["html","body","div.class.full-width-container",
                                                 "div.id.main","div.id.content","section","div",
                                                 "div.class.view-content","table","tbody"];
                                var linkNodes = that.parseHelper(parse5.parse(resolve),htmlTrace);
                                for (var childNode of linkNodes.childNodes) {
                                    if (childNode.nodeName == "tr") {
                                        htmlTrace = ["td.class.views-field views-field-nothing","a"];
                                        var childNodeValue = that.parseHelper(childNode, htmlTrace);
                                        for (var attr of childNodeValue.attrs) {
                                            var roomLink = attr.value.substring(2,attr.value.length);
                                            if (roomLinks.indexOf(roomLink) == -1) {
                                                roomLinks.push(attr.value.substring(2,attr.value.length));
                                            }
                                        }
                                    }
                                }

                                var lengthOfArray = roomLinks.length;
                                var i = 0;
                                zip.forEach(function (relativePath, file) {
                                    if (roomLinks.indexOf(file.name) > -1) {
                                        file.async("string").then(function (resolved) {
                                            that.rooms = that.rooms.concat(that.roomHelper(resolved));
                                            i++;

                                            if (i == lengthOfArray) {
                                                var retArrayLength = that.rooms.length;
                                                var j = 0;
                                                that.rooms.forEach(function (room: Room) {
                                                    that.callGeoProvider(that.buildURL(room.address)).then(function (response) {
                                                        room.lat = response.lat;
                                                        room.lon = response.lon;
                                                        j++;

                                                        if (j == retArrayLength) {
                                                            var saved = that.save(id, that.rooms);
                                                            that.rooms = new Array<any>();
                                                            fulfill(saved);
                                                        }
                                                    }).catch(function (err) {
                                                        reject(err);
                                                    });
                                                });
                                            }
                                        });
                                    }
                                });
                            });
                        }
                    }

                }).catch(function (err) {
                    Log.trace('DatasetController::process(..) - unzip ERROR: ' + err.message);
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    public buildURL (address:string): string {
        var urlstr:String = address.replace(/ /g,"%20");
        var completeRequest = "/api/v1/team30/"+urlstr;
        return completeRequest;

    }

    public callGeoProvider (addressUrl:string): Promise<any> {
        return new Promise(function (fulfill, reject) {
            var client = restify.createJsonClient({
                url: "http://skaha.cs.ubc.ca:8022",
                version: '*'
            })
            client.get(addressUrl, function (err: any, req: any, res: any, obj: any): any {
                if (err) {
                    Log.trace("ERROR IN GET");
                    reject(err);
                }
                return fulfill(obj);
            })
        });
    }
    /**
     * Deletes both disk and memory caches for the dataset with id
     *
     * @param id
     */
    public delete(id:string): Promise<boolean>{
        Log.trace('DatasetController::delete( ' + id + '... )'); 
        let that = this; 
        return new Promise(function (fulfill, reject) { 
            try { 
                var wantedDataset = that.getDataset(id); 
                if (wantedDataset != null){ 
                    that.datasets[id] = null; 
                    fs.unlinkSync(path.join(__dirname,"/data/"+ id)); 
                    fulfill(true); 
                }  else { 
                    reject(new Error("Resource was not previously PUT")); 
                } 
            } catch (err) { 
                reject(err); 
            }  
        });
    }

    /**
     * Writes the processed dataset to disk as 'id.json'. The function should overwrite
     * any existing dataset with the same name.
     *
     * @param id
     * @param processedDataset
     * @returns number - the code of success
     */
    private save(id: string, processedDataset: any): number {
        // add it to the memory model
        var code: number;
        if (this.getDataset(id) == null) {
            code = 204;
        } else {
            code = 201;
        }

        this.datasets[id] = processedDataset;

        // TODO: actually write to disk in the ./data directory
        // create ./data directory for easy access in the future
        try {
            fs.mkdirSync(path.join(__dirname,"/data/"));
        } catch (err) {
            // do nothing, becase directory already exists, but the err needs to be caught
        }
        fs.writeFile(path.join(__dirname,"/data/"+id),JSON.stringify(processedDataset));
        Log.trace("DatasetController::process(..) - json is saved successfully.");

        return code;
    }

    private roomHelper (htmlContent: string): Array<Room> {
        var roomArray = new Array<Room>();
        var document: any = parse5.parse(htmlContent);
        var htmlTrace: string[];

        // building fields
        htmlTrace = ["html","body","div.class.full-width-container","div.id.main",
                     "div.id.content","section","div","div.class.view-content","div",
                     "div.id.buildings-wrapper","div.id.building-info","h2","span"];
        var fullName = parse5.serialize(this.parseHelper(document,htmlTrace));

        htmlTrace = ["html","head","link.rel.canonical"];
        var shortName = this.parseHelper(document,htmlTrace).attrs[1].value;

        htmlTrace = ["html","body","div.class.full-width-container","div.id.main",
                     "div.id.content","section","div","div.class.view-content","div",
                     "div.id.buildings-wrapper","div.id.building-info","div.class.building-field",
                     "div.class.field-content"];
        var address = parse5.serialize(this.parseHelper(document,htmlTrace));

        var lat = 0;
        var lon = 0;

        // room fields
        var number = "";
        var name = "";
        var seats = 0;
        var type = "";
        var furniture = "";
        var href = "";

        htmlTrace = ["html","body","div.class.full-width-container","div.id.main","div.id.content",
                     "section","div","div.class.view-footer","div","div.class.view-content","table","tbody"];
        var roomNodes = this.parseHelper(document,htmlTrace);
        for (var childNode of roomNodes.childNodes) {
            if (childNode.nodeName == "tr") {
                htmlTrace = ["td.class.views-field views-field-field-room-number","a"];
                number = parse5.serialize(this.parseHelper(childNode,htmlTrace));
                name = shortName + "_" + number;

                htmlTrace = ["td.class.views-field views-field-field-room-capacity"];
                seats = parseInt(parse5.serialize(this.parseHelper(childNode,htmlTrace)).trim());

                htmlTrace = ["td.class.views-field views-field-field-room-type"];
                type = parse5.serialize(this.parseHelper(childNode,htmlTrace)).trim();

                htmlTrace = ["td.class.views-field views-field-field-room-furniture"];
                furniture = parse5.serialize(this.parseHelper(childNode,htmlTrace)).trim().replace("amp;","");

                htmlTrace = ["td.class.views-field views-field-nothing","a"];
                href = this.parseHelper(childNode, htmlTrace).attrs[0].value;

                roomArray.push(new Room(fullName, shortName, number, name, address, lat, lon, seats, type, furniture, href));
            }
        }

        return roomArray;
    }

    private parseHelper (htmlContent: ASTNode, path: string[]): ASTNode {
        var returnHtmlContent: ASTNode;
        var tempChildren: Array<ASTNode>;

        var children = htmlContent.childNodes;

        for (var pathPart of path) {
            var pathParts = pathPart.split(".");
            var c = 0;
            children.forEach(function (child: ASTNode) {
                if (child.nodeName == pathParts[0]) {
                    if (pathParts.length == 1) {
                        returnHtmlContent = child;
                        tempChildren = child.childNodes;
                    } else if (pathParts.length == 3) {
                        child.attrs.forEach(function (attr: ASTAttribute) {
                            if (attr.name == pathParts[1] && attr.value == pathParts[2] && c==0) {
                                returnHtmlContent = child;
                                tempChildren = child.childNodes;
                                c++;
                            }
                        });
                    }
                }
            });
            children = tempChildren;
        }

        return returnHtmlContent;
    }

}
