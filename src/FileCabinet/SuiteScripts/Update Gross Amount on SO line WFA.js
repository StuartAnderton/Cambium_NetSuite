/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */

//WFA Script to set the Gross Amount of a SO line based on a custom field workflow

define(['N/record', 'N/runtime'],
    function (record, runtime) {
        function onAction(scriptContext) {

            var taxRate;

            var myScript = runtime.getCurrentScript();
            var stdRateVat = myScript.getParameter({
                name: 'custscript_std_vat_rate_wfa'
            });
            var stdRateSchedule = myScript.getParameter({
                name: 'custscript_std_rate_schedule_wfa'
            });

            var itemFromWorkflow = scriptContext.newRecord;

            log.debug({title: 'Processing', details: itemFromWorkflow});
            log.debug({title: 'Script Schedule', details: stdRateSchedule});

            var itemId = itemFromWorkflow.getValue({
                fieldId: 'id'
            });

            var recordType = itemFromWorkflow.type;


            var sitePrice = itemFromWorkflow.getValue({
                    fieldId: 'custitem_delayed_price'
                }
            );

            var taxScheduleId = itemFromWorkflow.getValue({
                    fieldId: 'taxschedule'
                }
            );

            log.debug({title: 'Record Schedule', details: taxScheduleId});

            if (taxScheduleId == stdRateSchedule) {
                taxRate = stdRateVat;
            } else {
                taxRate = 0;
            }

            log.debug({title: 'Using Tax rate', details: taxRate});

            var basePrice = sitePrice / ((100 + taxRate) / 100);

            var item = record.load({
                type: recordType,
                id: itemId
            });

            // update prices and remove the date to avoid repeating

            item.setValue({
                fieldId: 'custitem_site_price_inc_vat',
                value: sitePrice
            });

            item.setValue({
                fieldId: 'custitem_price_change_from',
                value: null
            });

            // assuming that Base Price is row 1 column 1 and GBP is matrix 1.

            item.setMatrixSublistValue({
                sublistId: 'price1',
                fieldId: 'price',
                line: 0,
                column: 0,
                value: basePrice
            });

            var result = item.save();

            log.audit({title: 'Updated ' + result, details: 'New price ' + sitePrice});

            return;
        }


        return {
            onAction: onAction
        }
    });