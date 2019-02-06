import {InsightResponse, IInsightFacade} from "./IInsightFacade";
import {QueryRequest, default as QueryController} from "./QueryController"
import Log from '../Util';
import {Datasets, default as DatasetController} from "./DatasetController";

export default class InsightFacade implements IInsightFacade {

    private datasetController = new DatasetController();

    /**
     * Add a dataset to UBCInsight.
     *
     * @param id  The id of the dataset being added. This is the same as the PUT id.
     * @param content  The base64 content of the dataset. This is the same as the PUT body.
     *
     * The promise should return an InsightResponse for both fullfill and reject.
     * fulfill should be for 2XX codes and reject for everything else.
     */
    public addDataset(id: string, content: string): Promise<InsightResponse> {
        Log.trace('InsightFacade::addDataset(..) - params:' + id );
        let resp = <InsightResponse>{};
        let that = this;
        return new Promise(function (fulfill, reject) {
            if (id == "") {
                resp.code = 400;
                resp.body = {error: "id field is empty"};
                reject(resp);
            }
            Log.trace('InsightFacade::addDataset(..) on end; total length: ' + content.length);
            let controller = new DatasetController();
            that.datasetController.process(id, content).then(function (result: number) {
                if (result == 204) {
                    Log.trace('InsightFacade::addDataset(..) - the operation was successful and the id was new');
                    resp.code = result;
                } else if (result == 201) {
                    Log.trace('InsightFacade::addDataset(..) - the operation was successful and the id already existed');
                    resp.code = result;
                }
                resp.body = {success: true};
                fulfill(resp);
            }).catch(function (err: Error) {
                Log.trace('InsightFacade::addDataset(..) - ERROR: ' + err.message);
                resp.code = 400;
                resp.body = {error: err.message};
                reject(resp);
            });
            //NOTE: MIGHT NEED TO WRAP WITH TRY CATCH?
        });
    }

    /**
     * Remove a dataset from UBCInsight.
     *
     * @param id  The id of the dataset to remove. This is the same as the DELETE id.
     *
     * The promise should return an InsightResponse for both fullfill and reject.
     * fulfill should be for 2XX codes and reject for everything else.
     */
    public removeDataset(id: string): Promise<InsightResponse> {
        Log.trace ('InsideFacade::removeDataset(..)- params: ' + id);
        let resp = <InsightResponse>{};
        let that = this;
    	return new Promise(function (fulfill, reject) {
            that.datasetController.delete(id).then(function(result:boolean){
                Log.trace('InsightFacade::removeDataset(..)- the operation was successful');
                resp.code = 204;
                resp.body = {success:result};
                fulfill(resp);
            }).catch(function (err:Error){
                Log.trace('InsightFacade::removeDataset(..) - ERROR: ' + err.message);
                resp.code = 404;
                resp.body = {error: err.message};
                reject(resp);
            });
            //NOTE: MIGHT NEED TO WRAP WITH TRY CATCH?
    	});
    }

    /**
     * Perform a query on UBCInsight.
     *
     * @param query  The query to be performed. This is the same as the body of the POST message.
     * @return Promise <InsightResponse>
     * The promise should return an InsightResponse for both fullfill and reject.
     * fulfill should be for 2XX codes and reject for everything else.
     */
    public performQuery(query: QueryRequest): Promise<InsightResponse> {
        Log.trace ('InsightFacade::performDataset(..)- params: ' + JSON.stringify(query));
        let resp = <InsightResponse>{};
        let that = this;
    	return new Promise(function (fulfill, reject) {
    	    try {
                let datasets: Datasets = that.datasetController.getDatasets();
                let controller = new QueryController(datasets);
                let isValid = controller.isValid(query);
                if (isValid == false) {
                    resp.code = 400;
                    resp.body = {error: 'invalid query'};
                    reject(resp);
                } else {
                    let result = controller.query(query);
                    resp.code = Number(result['code']);
                    resp.body = result['body'];
                    if (resp.code == 200) {
                    	fulfill(resp);
                    } else {
                    	reject(resp);
                    }
                }
            }catch (err) {
                resp.code = 403;
                resp.body = {error: err.message};
                reject(resp);
            }

    	});
    }

    /*
      Schedule courses into rooms.
    */
    public schedule(rooms: any, coursesList: any): Promise<InsightResponse> {
        //Log.trace(" rooms " + JSON.stringify(rooms));
        //Log.trace(" courses " + JSON.stringify(coursesList));
        let resp = <InsightResponse>{};
        let that = this;
        return new Promise(function (fulfill, reject) {
            try {
                var courses = new Array<any>();

                for (var room of rooms) {
                    room.MWFPrimeTime = {"8-9":"free",
                        "9-10":"free",
                        "10-11":"free",
                        "11-12":"free",
                        "12-13":"free",
                        "13-14":"free",
                        "14-15":"free",
                        "15-16":"free",
                        "16-17":"free"};
                    room.TThPrimeTime = {"8-9:30":"free",
                        "9:30-11":"free",
                        "11-12:30":"free",
                        "12:30-14":"free",
                        "14-15:30":"free",
                        "15:30-17":"free"};
                    room.MWFBadTime = {"17-18":"free",
                        "18-19":"free",
                        "19-20":"free",
                        "20-21":"free",
                        "21-22":"free"};
                    room.TThBadTime = {"17-18:30":"free",
                        "18:30-20":"free",
                        "20-21:30":"free"}
                }

                var ignoredTimeSlots = new Array<string>();
                for (var course of coursesList) {
                    courses = courses.concat(that.sliceCourse(course));
                }
                courses = courses.sort(function (a:any, b:any) {
                    var aValue = a["courses_size"];
                    var bValue = b["courses_size"];

                    if (aValue < bValue) {
                        return 1;
                    } else if (aValue > bValue) {
                        return -1;
                    } else {
                        return 0;
                    }
                });

                var quality = 0;
                var scheduledCourses = new Array<any>();
                var unscheduledCourses = new Array<any>();

                for (var course of courses) {
                    var i = 0;
                    var scheduled = that.scheduleIntoRoom(rooms,course,scheduledCourses,unscheduledCourses,ignoredTimeSlots,true);
                    if (scheduled != 0) {
                        quality += that.scheduleIntoRoom(rooms,course,scheduledCourses,unscheduledCourses,ignoredTimeSlots,false);
                    }
                }

                resp.code = 200;
                resp.body = {"rooms":rooms,
                    "quality":quality,
                    "scheduledSections":scheduledCourses,
                    "unscheduledSections":unscheduledCourses};
                fulfill(resp);
            } catch (err) {
                resp.code = 403;
                resp.body = {error: err.message};
                reject(resp);
            }
        });
    }


    private sliceCourse(course: any): Array<any> {
        var slicedCourses = new Array<any>();

        var numberOfSections = Math.ceil(course.numsections/3);
        let peoplePerSection = Math.floor(course.maxattended/numberOfSections);
        var extraPeople = course.maxattended - numberOfSections * peoplePerSection;

        for (var i = 1; i <= numberOfSections; i++) {
            var slicedCourse = {"courses_dept": course.courses_dept,
                "courses_id": course.courses_id,
                "courses_section": "00"+i,
                "courses_size": i==1?peoplePerSection+extraPeople:peoplePerSection};
            slicedCourses.push(slicedCourse);
        }
        return slicedCourses;
    }

    private scheduleIntoRoom(rooms: Array<any>, course: any, scheduledCourses: Array<any>, unscheduledCourses: Array<any>, ignoredTimeSlots: Array<string>, isPrimeTime: boolean): number {
        var i = 0;
        for (var roomIndex in rooms) {
            i++;
            var toBreak = false;
            for (var j = 0; j < 2; j++) {
                var schedule: any;
                if (j==0 && isPrimeTime)
                    schedule = rooms[roomIndex].MWFPrimeTime;
                else if (j==1 && isPrimeTime)
                    schedule = rooms[roomIndex].TThPrimeTime;
                else if (j==0 && !isPrimeTime)
                    schedule = rooms[roomIndex].MWFBadTime;
                else
                    schedule = rooms[roomIndex].TThBadTime;

                for (var timeSlot of Object.keys(schedule)) {
                    if (schedule[timeSlot] == "free" && rooms[roomIndex].rooms_seats >= course.courses_size) {
                        if (ignoredTimeSlots.indexOf(course.courses_dept+"_"+course.courses_id+"_"+timeSlot) == -1) {
                            schedule[timeSlot] = course.courses_dept + course.courses_id + " " + course.courses_section + " " + "(" + course.courses_size + " students)";
                            scheduledCourses.push(course);
                            ignoredTimeSlots.push(course.courses_dept+"_"+course.courses_id+"_"+timeSlot);
                            if (!isPrimeTime) {
                                return 1;
                            } else {
                                return 0;
                            }
                        }
                    }
                }
            }

            if (i == rooms.length && !isPrimeTime) {
                unscheduledCourses.push(course);
                return 1;
            }
        }
        return 1;
    }
}
