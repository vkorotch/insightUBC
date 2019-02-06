import {Datasets} from "../src/controller/DatasetController";
import QueryController from "../src/controller/QueryController";
import {QueryRequest} from "../src/controller/QueryController";
import {QueryResponse} from "../src/controller/QueryController";
import path = require('path');
import fs = require('fs');
import Log from "../src/Util";

import {expect} from 'chai';
describe("QueryController", function () {

    var zipFileContents: string = null;
    var queryController: QueryController = null;
    before(function () {
        Log.info('InsightController::before() - start');
        var dataset: Datasets = {"courses" : [{
                "dept": "adhe",
                "id": "327",
                "avg": 86.17,
                "instructor": "smulders, dave",
                "title": "teach adult",
                "pass": 23,
                "fail": 0,
                "audit": 0,
                "uuid": "234"
            },
            {
                "dept": "math",
                "id": "300",
                "avg": 66.11,
                "instructor": "yilmaz, ozgur",
                "title": "intr complex var",
                "pass": 63,
                "fail": 7,
                "audit": 0,
                "uuid": "23172"
            }]};
        queryController = new QueryController(dataset);

    });


    it("Should be able to validate a valid query", function () {
        // NOTE: this is not actually a valid query for D1
        let query: QueryRequest = {GET: 'food', WHERE: {IS: 'apple'}, ORDER: 'food', AS: 'table'};
        let dataset: Datasets = {};
        let controller = new QueryController(dataset);
        let isValid = controller.isValid(query);

        expect(isValid).to.equal(true);
    });

    it("Should be able to invalidate an invalid query", function () {
        let query: any = null;
        let dataset: Datasets = {};
        let controller = new QueryController(dataset);
        let isValid = controller.isValid(query);

        expect(isValid).to.equal(false);
    });

    it("Should be able to query, although the answer will be empty", function () {
        // NOTE: this is not actually a valid query for D1, nor is the result correct.
        let query: QueryRequest = {GET: 'food', WHERE: {IS: 'apple'}, ORDER: 'food', AS: 'table'};
        let dataset: Datasets = {};
        let controller = new QueryController(dataset);
        let ret = controller.query(query);
        Log.test('In: ' + JSON.stringify(query) + ', out: ' + JSON.stringify(ret));
        expect(ret).not.to.be.equal(null);
        // should check that the value is meaningful
    });


    it("Should return 400 if query.GET is empty", function () {

        var queryRequest = {
            "GET": new Array<string>(),
            "WHERE": {
                "GT": {
                    "courses_avg": 90
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        };
        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);


    });

    it("Should return 400 if query.GET is null", function () {

        var get: string = null;
        var queryRequest = {
            "GET": get,
            "WHERE": {
                "GT": {
                    "courses_avg": 90
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if query.WHERE is null", function () {

        var where: string = null;
        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": where,
            "ORDER": "courses_avg",
            "AS": "TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if query.AS is null", function () {

        var as: string = null;
        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "GT": {
                    "courses_avg": 90
                }
            },
            "ORDER": "courses_avg",
            "AS": as
        };
        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if query.AS.toUpperCase() != 'TABLE'", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": "cpsc"}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "UP", "keys": ["courseAverage", "courses_id"]},
            "AS":"wrongValue"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if some key in GET is not in APPLY nor in GROUP", function () {

        var queryRequest = {
            "GET": ["maxFail", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": "cpsc"}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "UP", "keys": ["courseAverage", "courses_id"]},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if orderFullKey is invalid", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": "cpsc"}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "UP", "keys": ["courseAverage", "invalid_key"]},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if GROUP has invalid keys", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": "cpsc"}} ,
            "GROUP": [ "invalid key" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "UP", "keys": ["courseAverage", "courses_id"]},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if ORDER clause is invalid (undefined dir)", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": "cpsc"}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "keys": ["courseAverage", "courses_id"]},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if ORDER clause is invalid (undefined keys)", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": "cpsc"}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "UP"},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if ORDER clause is invalid (empty keys)", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": "cpsc"}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "UP", "keys": new Array<string>()},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if ORDER clause is invalid (wrong dir)", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": "cpsc"}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "wrong", "keys": ["courseAverage", "courses_id"]},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should be able to process a query with NOT", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"NOT": {"IS": {"courses_dept": "cpsc"}}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "UP", "keys": ["courseAverage", "courses_id"]},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(200);

    });

    it("Should return 400 if IS comparator value is empty", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": ""}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "UP", "keys": ["courseAverage", "courses_id"]},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should return 400 if IS comparator value is not a string", function () {

        var queryRequest = {
            "GET": ["courses_id", "courseAverage"],
            "WHERE": {"IS": {"courses_dept": 90}} ,
            "GROUP": [ "courses_id" ],
            "APPLY": [ {"courseAverage": {"AVG": "courses_avg"}} ],
            "ORDER": { "dir": "UP", "keys": ["courseAverage", "courses_id"]},
            "AS":"TABLE"
        };

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should be able to process a query with EQ", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "EQ": {
                    "courses_avg": 90
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(200);

    });

    it("Should be able to process a query with LT", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "LT": {
                    "courses_avg": 90
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(200);

    });

    it("Should be able to process a query with GT", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "GT": {
                    "courses_avg": 90
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(200);

    });

    /*it("Should return 400 if EQ | GT | LT comparator value is NaN", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "EQ": {
                    "courses_avg": 0/0
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });*/

    it("Should return 400 if EQ | GT | LT comparator key is invalid", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "EQ": {
                    "coursesavg": 90
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should be able to process a query with IS", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "IS": {
                    "courses_instructor": "*smulders*"
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(200);

    });

    it("Should throw 'invalid IS query'", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "IS": {
                    "courses_instructor": "**"
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should be able to process a query with IS", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "IS": {
                    "courses_instructor": "smulders*"
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(200);

    });

    it("Should be able to process a query with IS", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "IS": {
                    "courses_instructor": "*smulders"
                }
            },
            "ORDER": "courses_avg",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(200);

    });

    it("Should not be able to process a query with _avg in APPLY", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courseAverage"],
            "WHERE": {
                "IS": {
                    "courses_instructor": "*smulders"
                }
            },
            "GROUP": [ "courses_dept" ],
            "APPLY": [ {"courseAverage": {"AVG": "_avg"}} ],
            "ORDER": "courseAverage",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

    it("Should not be able to process a query with invalid ORDER", function () {

        var queryRequest = {
            "GET": ["courses_dept", "courses_avg"],
            "WHERE": {
                "IS": {
                    "courses_instructor": "*smulders"
                }
            },
            "ORDER": "courses_instructor",
            "AS": "TABLE"
        }

        let response = queryController.query(queryRequest);
        expect(response["code"]).to.equal(400);

    });

});
