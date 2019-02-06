import restify = require('restify');
import fs = require('fs');

import DatasetController from '../controller/DatasetController';
import {Datasets} from '../controller/DatasetController';
import QueryController from '../controller/QueryController';

import {QueryRequest} from "../controller/QueryController";
import Log from '../Util';
import InsightFacade from "../controller/InsightFacade";

export default class RouteHandler {

    // ONLY KNOW ABOUT INSIGHT NOT ABOUT ANY COTROLLERS

    //private static insightFacade = new InsightFacade();

    public static getHomepage(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace('RoutHandler::getHomepage(..)');
        fs.readFile('./src/rest/views/index.html', 'utf8', function (err: Error, file: Buffer) {
            if (err) {
                res.send(500);
                Log.error(JSON.stringify(err));
                return next();
            }
            res.write(file);
            res.end();
            return next();
        });
    }

    public static  putDataset(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace('RouteHandler::postDataset(..) - params: ' + JSON.stringify(req.params));
        let that = this;
        try {
            var id: string = req.params.id;
            // stream bytes from request into buffer and convert to base64
            // adapted from: https://github.com/restify/node-restify/issues/880#issuecomment-133485821
            let buffer: any = [];
            req.on('data', function onRequestData(chunk: any) {
                Log.trace('RouteHandler::postDataset(..) on data; chunk length: ' + chunk.length);
                buffer.push(chunk);
            });
            req.once('end', function () {
                let concated = Buffer.concat(buffer);
                req.body = concated.toString('base64');
                let facade = new InsightFacade();
                facade.addDataset(id, req.body).then(function (finalResp: any) {
                    res.json(finalResp.code, finalResp.body);
                }).catch(function (finalResp: any) {
                    res.json(finalResp.code, finalResp.body);
                });
            });
            //NOT SURE ABOUT THIS TRY CATCH!! COME BACK TO DIS

        } catch (err) {
            Log.error('RouteHandler::postDataset(..) - ERROR: ' + err.message);
            res.send(400, {err: err.message});
        }
        return next();
    }

    public static postQuery(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace('RouteHandler::postQuery(..) - params: ' + JSON.stringify(req.params));
        let that = this;
        try {
            let query: QueryRequest = req.params;
            let facade = new InsightFacade();
            facade.performQuery(query).then(function (finalResp: any) {
                res.json(finalResp.code, finalResp.body);
            }).catch(function (finalResp: any) {
                res.json(finalResp.code, finalResp.body);
            });

        } catch (err) {
            Log.error('RouteHandler::postQuery(..) - ERROR: ' + err);
            res.send(403);
        }
        return next();
    }

    public static postSchedule(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace('RouteHandler::postQuery(..) - params: ' + JSON.stringify(req.params));
        let that = this;
        try {
            let roomsArray: any = req.params.rooms;
            //Log.trace(JSON.stringify(roomsArray.rooms[0]));
            let coursesArray: any= req.params.courses;
            let facade = new InsightFacade();
            facade.schedule(roomsArray,coursesArray).then(function (finalResp: any) {
                res.json(finalResp.code, finalResp.body);
            }).catch(function (finalResp: any) {
                res.json(finalResp.code, finalResp.body);
            });

        } catch (err) {
            Log.error('RouteHandler::postQuery(..) - ERROR: ' + err);
            res.send(403);
        }
        return next();
    }

    public static deleteDataset(req: restify.Request, res: restify.Response, next: restify.Next){
        Log.trace ('RouteHandler::deleteDataset(..)- params: ' + JSON.stringify(req.params));
        let that = this;
        try {
            var id: string = req.params.id;
            let facade = new InsightFacade();
            facade.removeDataset(id).then(function (finalResp: any) {
                res.json(finalResp.code, finalResp.body);
            }).catch(function (finalResp: any) {
                res.json(finalResp.code, finalResp.body);
            });


        }catch (err){
            Log.error('RouteHandler::deleteDataset(..) - ERROR: ' + err);
            res.send(404);
        }
        return next();
    }
}
