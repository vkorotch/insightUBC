import {Datasets} from "./DatasetController";
import Log from "../Util";

export interface QueryRequest {
    GET: string|string[];
    WHERE: {};
    GROUP?: string[];
    APPLY?: {};
    ORDER?: string|{};
    AS: string;
}

export interface QueryResponse {
    [key: string] : {};
}

export interface Hash {
    [key: string] : {};
}

export interface HashArray {
    [key: string] : Array<any>;
}


export class Body {
    render: string;
    result: Array<any>;

    constructor () {
        this.render = "";
        this.result = new Array<any>();
    }
}

export interface JSONBody {
    [key: string] : any;
}


export default class QueryController {
    private datasets: Datasets = null;

    private validKeys =  new Array<String>();


    constructor(datasets: Datasets) {
        this.datasets = datasets;
        this.validKeys = ["dept", "id", "avg", "instructor", "title", "pass", "fail", "audit", "year",
        "fullname", "shortname", "number", "name", "address", "lat", "lon", "seats", "type", "furniture", "href"];
    }

    public isValid(query: QueryRequest): boolean {
        if (typeof query !== 'undefined' && query !== null && Object.keys(query).length > 0) {
            return true;
        }
        return false;
    }

    public query(query: QueryRequest): QueryResponse {
        var response: QueryResponse = {};

        Log.trace('QueryController::query( ' + JSON.stringify(query) + ' )');

        if (query.GET == null || query.GET == undefined || query.GET.length < 1) {
            response["code"] = 400;
            response["body"] = {error: 'invalid query'};
            return response;
        }
        if (query.WHERE == null || query.WHERE == undefined) {
            response["code"] = 400;
            response["body"] = {error: 'invalid query'};
            return response;
        }
        if (query.AS == null || query.AS == undefined) {
            response["code"] = 400;
            response["body"] = {error: 'invalid query'};
            return response;
        }
        if (query.AS.toUpperCase() != "TABLE") {
            response["code"] = 400;
            response["body"] = {error: 'invalid query'};
            return response;
        }
        if ((query.GROUP != null || query.GROUP != undefined) &&
            (query.APPLY == null && query.APPLY == undefined)) {
            response["code"] = 400;
            response["body"] = {error: 'invalid query'};
            return response;
        }
        if ((query.APPLY != null || query.APPLY != undefined) &&
            (query.GROUP == null && query.GROUP == undefined)) {
            response["code"] = 400;
            response["body"] = {error: 'invalid query'};
            return response;
        }

        var body = new Body();
        body.render = query.AS;

        var isGroupPresent = (query.GROUP != null && query.GROUP != undefined);
        var getFullKeys = new Array<string>();
        var getActualKeys = new Array<string>();
        var groupFullKeys = new Array<string>();
        var groupActualKeys = new Array<string>();
        var applyKeys = new Array<string>();
        if (isGroupPresent) {
            for (var key of query.GROUP) {
                if (key.indexOf("_") < 1 || key.lastIndexOf("_") == key.length-1)
                {
                    response["code"] = 400;
                    response["body"] = {error: 'a key ' + key + ' is invalid.'};
                    return response;
                }
                var actualKey = key.substr(key.lastIndexOf("_") + 1);
                groupActualKeys.push(actualKey);
                groupFullKeys.push(key);
            }

            for (var key of Object.keys(query.APPLY)) {
                var queryObject: any = query.APPLY;
                for (var insideKey of Object.keys(queryObject[key])) {
                    var outsideValue = queryObject[key][insideKey];
                    for (var doubleInsideKey of Object.keys(outsideValue)) {
                        var insideValue = outsideValue[doubleInsideKey];
                        Log.trace(JSON.stringify(insideValue));
                        if (insideValue.indexOf("_") < 1 || insideValue.lastIndexOf("_") == insideValue.length-1)
                        {
                            response["code"] = 400;
                            response["body"] = {error: 'a key ' + insideValue + ' is invalid.'};
                            return response;
                        }
                    }
                    applyKeys.push(insideKey);
                }
            }

            for (var groupKey of groupFullKeys) {
                for (var applyKey of applyKeys) {
                    if (groupKey == applyKey) {
                        response["code"] = 400;
                        response["body"] = {error: 'a key ' + groupKey + ' is in both GROUP and APPLY.'};
                        return response;
                    }
                }
            }

            for (var key of query.GET) {
                if (groupFullKeys.indexOf(key) > -1 || applyKeys.indexOf(key) > -1) {
                    getFullKeys.push(key);
                } else {
                    response["code"] = 400;
                    response["body"] = {error: 'a key ' + key + ' is neither in GROUP nor APPLY.'};
                    return response;
                }
            }
        } else {
            for (var key of query.GET) {
                if (key.indexOf("_") < 1 || key.lastIndexOf("_") == key.length-1)
                {
                    response["code"] = 400;
                    response["body"] = {error: 'a key ' + key + ' is invalid.'};
                    return response;
                }
                var actualKey = key.substr(key.lastIndexOf("_") + 1);
                getActualKeys.push(actualKey);
                getFullKeys.push(key);
            }
        }

        var underscoreIndex = getFullKeys[0].indexOf("_");
        var id = getFullKeys[0].substr(0,underscoreIndex);

        if (this.datasets[id]!=null) {

            var results = JSON.parse(JSON.stringify(this.datasets[id]));
            var whereObject = JSON.parse(JSON.stringify(query.WHERE));


            if (Object.keys(whereObject).length > 0) {
                try {
                    results = this.whereClauseHelper(whereObject, results);
                } catch (err) {
                    if (err.error == 'dataset was not previously PUT'){
                        response["code"] = 424;
                    } else {
                        response["code"] = 400;
                    }
                    response["body"] = err.error;
                    return response;
                }
            }

            if (isGroupPresent) {
                var groupResults: HashArray = {};

                for (var result of results) {
                    var groupKeyBody: JSONBody = {};
                    for (var index in groupFullKeys) {
                        groupKeyBody[groupFullKeys[index]] = result[groupActualKeys[index]];
                    }

                    var key = JSON.stringify(groupKeyBody);
                    if (!groupResults.hasOwnProperty(key)) {
                        groupResults[key] = new Array<any>();
                    }

                    for (var keyname of Object.keys(result)) {
                        result[id + "_" + keyname] = result[keyname];
                        delete result[keyname];
                    }

                    groupResults[key].push(result);
                }

                results = new Array<any>();
                for (var key of Object.keys(groupResults)) {
                    var applied = this.applyClauseHelper(query.GROUP, query.APPLY, groupResults[key]);
                    results.push(applied);
                }
            }

            // form the result
            for (var result of results) {
                var jsonBody: JSONBody = {};
                if (isGroupPresent) {
                    for (var key of getFullKeys) {
                        jsonBody[key] = result[key];
                    }
                    for (var key of applyKeys) {
                        if (getFullKeys.indexOf(key) == -1) {
                            jsonBody[key] = result[key];
                        }
                    }
                } else {
                    for (var index in getActualKeys) {
                        jsonBody[getFullKeys[index]] = result[getActualKeys[index]];
                    }
                }
                body.result.push(jsonBody);
            }

            if (query.ORDER != null && query.ORDER != undefined) {
                if (typeof query.ORDER == "string") {
                    var orderFullKey = query.ORDER.toString(); // get a full key ("id_actualkey")
                    if (getFullKeys.indexOf(orderFullKey) == -1 && applyKeys.indexOf(orderFullKey) == -1)
                    {
                        response["code"] = 400;
                        response["body"] = {error: 'a key ' + orderFullKey + ' is invalid.'};
                        return response;
                    }

                    body.result = body.result.sort(function (a:any, b:any) {
                        var aValue = a[orderFullKey];
                        var bValue = b[orderFullKey];

                        if (typeof aValue == "string") {
                            aValue.toLowerCase();
                        }
                        if (typeof bValue == "string") {
                            bValue.toLowerCase();
                        }

                        if (aValue > bValue) {
                            return 1;
                        } else if (aValue < bValue) {
                            return -1;
                        } else {
                            return 0;
                        }
                    });
                } else {
                    var orderObject = JSON.parse(JSON.stringify(query.ORDER));
                    if (orderObject.dir == null || orderObject.dir == undefined ||
                        orderObject.keys == null || orderObject.keys == undefined ||
                        orderObject.keys.length < 1) {
                        response["code"] = 400;
                        response["body"] = {error: 'invalid ORDER clause'};
                        return response;
                    }

                    var orderInteger = 1;
                    if (orderObject.dir.toUpperCase() == "UP") {
                        orderInteger = 1;
                    } else if (orderObject.dir.toUpperCase() == "DOWN") {
                        orderInteger = -1;
                    } else {
                        response["code"] = 400;
                        response["body"] = {error: 'invalid dir in ORDER clause'};
                        return response;
                    }

                    for (var orderKey of orderObject.keys) {
                        if (getFullKeys.indexOf(orderKey) == -1 && applyKeys.indexOf(orderKey) == -1)
                        {
                            response["code"] = 400;
                            response["body"] = {error: 'a key ' + orderKey + ' is invalid.'};
                            return response;
                        }
                    }

                    body.result = body.result.sort(function (a:any, b:any) {
                        for (var orderKey of orderObject.keys) {
                            var aValue = a[orderKey];
                            var bValue = b[orderKey];


                            if (aValue > bValue) {
                                return orderInteger;
                            } else if (aValue < bValue) {
                                return -orderInteger;
                            }
                        }
                        return 0;
                    });
                }
            }

            for (var resIndex in body.result) {
                for (var resKey of Object.keys(body.result[resIndex])) {
                    if (getFullKeys.indexOf(resKey) == -1) {
                        delete body.result[resIndex][resKey];
                    }
                }
            }

            response["code"] = 200;
            response["body"] = body;
        } else {
            response["code"] = 424;
            response["body"] = {missing: ['"' + id + '"']};
        }

        return response;
    }

    private whereClauseHelper(whereObject: any, results: any) : any {
        //Log.trace("start");
        let that = this;
        var key = Object.keys(whereObject)[0];
        var retResults = new Array<any>();

        if (key == "AND") {
            if (whereObject[key].length < 1) {
                throw {error: 'not enough predicates for AND query'};
            }
            var i = 0;
            for (var partOfWhereObject of whereObject[key]) {
                if (i == 0) {
                    retResults = this.whereClauseHelper(partOfWhereObject, results);
                } else {
                    retResults = this.whereClauseHelper(partOfWhereObject,retResults);
                }
                i++;
            }
        } else if (key == "OR") {
            if (whereObject[key].length < 1) {
                throw {error: 'not enough predicates for OR query'};
            }
            var i = 0;
            for (var partOfWhereObject of whereObject[key]) {
                var subResults = this.whereClauseHelper(partOfWhereObject,results);
                if (i == 0) {
                    retResults = subResults;
                } else {
                    var map: Hash = {};

                    for (var retResult of retResults) {
                        map[JSON.stringify(retResult)] = null;
                    }

                    for (var subResult of subResults) {
                        if (!map.hasOwnProperty(JSON.stringify(subResult))) {
                            retResults.push(subResult);
                        }
                    }
                }
                i++;
            }
        } else if (key == "NOT") {
                var subResults = this.whereClauseHelper(whereObject[key],results);
                var map: Hash = {};

                for (var subResult of subResults) {
                    map[JSON.stringify(subResult)] = null;
                }

                for (var result of results) {
                    if (!map.hasOwnProperty(JSON.stringify(result))) {
                        retResults.push(result);
                    }
                }
        } else if (key == "IS") {
            var comparatorFullKey = Object.keys(whereObject[key])[0]; // get a full key ("id_actualkey")
            if (comparatorFullKey.indexOf("_") < 1 || comparatorFullKey.lastIndexOf("_") == comparatorFullKey.length-1) {
                throw {error: 'a key ' + comparatorFullKey + ' is invalid.'};
            }
            var comparatorKey = comparatorFullKey.substr(comparatorFullKey.lastIndexOf("_") + 1); // get a second (actual) part of the key
            var comparatorValue = whereObject[key][comparatorFullKey];
            if (typeof comparatorValue != "string") {
                throw {error: 'IS comparison is for strings only'};
            }

            var strLength: number;
            if (comparatorValue.indexOf("*") == 0 && comparatorValue.lastIndexOf("*") == comparatorValue.length - 1) {
                var subComparatorValue = comparatorValue.substr(1,comparatorValue.length-2);
                strLength = subComparatorValue.length;
                if (strLength < 1) {
                    throw {error: 'invalid IS query'};
                }
                retResults = results.filter(function (result: any) { return result[comparatorKey].indexOf(subComparatorValue) > -1});
            } else if (comparatorValue.indexOf("*") == 0) {
                var subComparatorValue = comparatorValue.substr(1,comparatorValue.length - 1);
                strLength = subComparatorValue.length;
                if (strLength < 1) {
                    throw {error: 'invalid IS query'};
                }
                retResults = results.filter(function (result: any) { return result[comparatorKey].lastIndexOf(subComparatorValue) == result[comparatorKey].length-subComparatorValue.length});
            } else if (comparatorValue.indexOf("*") == comparatorValue.length - 1) {
                var subComparatorValue = comparatorValue.substr(0,comparatorValue.length - 1);
                strLength = subComparatorValue.length;
                if (strLength < 1) {
                    throw {error: 'invalid IS query'};
                }
                retResults = results.filter(function (result: any) { return result[comparatorKey].indexOf(subComparatorValue) == 0});
            } else if (comparatorValue.indexOf("*") == -1) {
                strLength = comparatorValue.length;
                if (strLength < 1) {
                    throw {error: 'invalid IS query'};
                }
                retResults = results.filter(function (result: any) { return result[comparatorKey] == comparatorValue});
            } else {
                // reject it
                throw {error: 'invalid IS query'};
            }
        } else if (key == "GT" || key == "LT" || key == "EQ") {
            var comparatorFullKey = Object.keys(whereObject[key])[0]; // get a full key ("id_actualkey")
            if (comparatorFullKey.indexOf("_") < 1 || comparatorFullKey.lastIndexOf("_") == comparatorFullKey.length-1) {
                throw {error: '!!a key ' + comparatorFullKey + ' is invalid.'};
            }
            var comparatorID = comparatorFullKey.substr(0,comparatorFullKey.indexOf("_"));
            Log.trace (comparatorID);
            if (this.datasets[comparatorID]==null){
                throw {error:'dataset was not previously PUT'}
            }
            var comparatorKey = comparatorFullKey.substr(comparatorFullKey.lastIndexOf("_") + 1); // get a second (actual) part of the key
            Log.trace (comparatorKey);
            if (that.validKeys.indexOf(comparatorKey) == -1){
                throw{ error: "invalid key "+ comparatorKey};
            }
            var comparatorValue = whereObject[key][comparatorFullKey];
            comparatorValue = parseInt(comparatorValue);
            if (comparatorValue == NaN) {
                throw {error: 'GT|LT|EQ comparison is for numbers only'};
            }

            if (key == "GT") {
                retResults = results.filter(function (result: any) { return result[comparatorKey] > comparatorValue});
            } else if (key == "LT") {
                retResults = results.filter(function (result: any) { return result[comparatorKey] < comparatorValue});
            } else if (key == "EQ") {
                retResults = results.filter(function (result: any) { return result[comparatorKey] == comparatorValue});
            }
        } else {
            throw {error: 'invalid query keyword'  + key + '"'};
        }

        return retResults;
    }

    public applyClauseHelper(groupObject: any, applyObject: any, inputArray: Array<any>) : any {
        var dictToPush: any = {};
        for (var i of groupObject){
            dictToPush[i] = inputArray[0][i];
        }
        for (var obj of applyObject){
            var key = Object.keys(obj)[0];
            var value = obj[key];
            var operator = Object.keys(value)[0];
            var field = value[operator];
            var applyHelperResult = this.applyHelper(operator, field, inputArray);
            dictToPush[key] = applyHelperResult;
        }
        return dictToPush;
    }

    private applyHelper(operator: string, field: string, input: Array<any>): number {
        if (operator == "MAX"){
            return Math.max.apply(Math, input.map(function(o){return o[field]}));
        } else if (operator == "MIN"){
            return Math.min.apply(Math, input.map(function(o){return o[field]}));
        } else if (operator == "AVG"){
            var sum = 0;
            for (var i of input) {
                sum = sum + i[field];
            }

            return parseFloat((sum/(input.length)).toFixed(2));
        } else if (operator == "COUNT"){
            var map: Hash = {};
            var counter = 0;
            for (var i of input){
                if (!map.hasOwnProperty(i[field])) {
                    counter++;
                    map[i[field]] = null;
                }
            }
            return counter;
        }
    }

}
