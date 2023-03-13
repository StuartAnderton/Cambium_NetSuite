/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

// Populates a JSON object with the data for Akeneo.

define(['N/record', 'N/search'],

    // Add the callback function.
    function (record, search) {


        function myBeforeSubmit(context) {

            var newItem = context.newRecord;
            log.debug('Processing', JSON.stringify(newItem))

            newItem.setValue({
                fieldId: 'custitem_json_akeneo',
                value: null
            })

            var newData = JSON.stringify(newItem);

            newItem.setValue({
                fieldId: 'custitem_json_akeneo',
                value: newData
            })

        }

        // Add the return statement that identifies the entry point functions.
        return {
            beforeSubmit: myBeforeSubmit
        };
    });