import DatasetController from "../src/controller/DatasetController";
import Log from "../src/Util";

import JSZip = require('jszip');
import fs = require('fs');
import path = require('path');
import {expect} from 'chai';

describe("DatasetController", function () {

    beforeEach(function () {
    });

    afterEach(function () {
    });

    it("Should not be able to process invalid dataset", function () {
        Log.test('Creating dataset');
        let content = {key: 'value'};
        let zip = new JSZip();
        zip.file('content.obj', JSON.stringify(content));
        const opts = {
            compression: 'deflate', compressionOptions: {level: 2}, type: 'base64'
        };
        return zip.generateAsync(opts).then(function (data) {
            Log.test('Dataset created');
            let controller = new DatasetController();
            controller.process('setA', data).then(function (result) {
                expect.fail();
            }).catch(function (result) {
                expect.fail();
            });
        });

    });

    it("Should be able to get a GeoLocation", function(){
        let address = "1871 West Mall";
        let controller = new DatasetController();
        var  built:string = controller.buildURL(address);
        return controller.callGeoProvider(built).then(function (response: any){
            Log.trace(JSON.stringify(response));
            expect(response).haveOwnProperty("lat");
            expect(response).haveOwnProperty("lon");

        }).catch(function (response:any) {
            Log.trace(response);
        });
    });

    it("Should be able to process rooms dataset", function () {
        Log.test('Creating dataset');
        let content = {key: 'value'};
        let zip = new JSZip();
        zip.file('../../cpsc310d1public/310rooms.1.1.zip', JSON.stringify(content));
        const opts = {
            compression: 'deflate', compressionOptions: {level: 2}, type: 'base64'
        };
        let zipFileContents = new Buffer(fs.readFileSync(path.join(__dirname, '../../cpsc310d1public_team30/310rooms.1.1.zip'))).toString('base64');
        let controller = new DatasetController();
        controller.process("rooms", zipFileContents).then(function (result) {
            expect(result).to.be.not.undefined;
        }).catch(function (result) {
            expect.fail();
        });

    });

});
