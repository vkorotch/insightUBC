import Log from "../src/Util";
var lodash = require('lodash');
var fs = require('fs');
//var stringify = require('json-stable-stringify');

export default class TestUtil {

    /**
     * Compare an input to expected array.
     *
     * Use the json-stable-stringify to sort the keys in each element (if the keys are out of order it won't match correctly).
     *
     * If the sort key is provided we assume the expected is _already_ in the right order.
     *
     * If the sort key is null the order doesn't matter so we sort the array by its string value.
     *
     * @param input
     * @param expected
     * @param sortKey
     * @returns {boolean}
     */
    static compareJSONArrays(input: any[], expected: any[], sortKey: string): boolean {

        // check to make sure there are the right number of each expected object
        let a = lodash.countBy(input)// (input, stringify);
        let b = lodash.countBy(expected);
        let firstEqual = lodash.isEqual(a, b);
        // if they aren't the same, fail fast and return an error
        if (!firstEqual) {
            Log.warn('compareJSONArray failure: ');
            Log.trace('compareJSONArray expected: ' + JSON.stringify(expected));
            Log.trace('compareJSONArray actual v: ' + JSON.stringify(input));
            return false;
        }

        // order only matters if there is a sort key, otherwise the counts above are sufficient
        if (sortKey !== null) {
            // if sorted, loop through the elems
            if (input.length > 0) {
                let previous = (input[0])[sortKey];
                let current: any;
                for (let entry of input) {
                    current = entry[sortKey];
                    // make sure the previous entry isn't larger than the current entry
                    if (previous > current) {
                        Log.warn('compareJSONArray sort failure (on ' + sortKey + ' )');
                        Log.trace('compareJSONArray expected: ' + JSON.stringify(previous) + " to be less than: " + JSON.stringify(current));
                        return false;
                    }
                    previous = current;
                }
            }
        }
        return true;
    }
    static generateResultJSON(query: any): {} {
        let file = fs.readFileSync("./test/results/" + query)
        return JSON.parse(file);
    }

}
