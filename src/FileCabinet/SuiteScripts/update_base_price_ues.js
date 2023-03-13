/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

//UES Script to set Base Price from Site Price Inc VAT

// Load  standard modules.
define(['N/record', 'N/runtime'],

    // Add the callback function.
    function (record, runtime) {


        function beforeSubmit(context) {

            const itemFromWorkflow = context.newRecord;

            const sitePrice = itemFromWorkflow.getValue({
                    fieldId: 'custitem_site_price_inc_vat'
                }
            );

            const oldItem = context.oldRecord;

            if (oldItem) {

                var oldSitePrice = oldItem.getValue({
                        fieldId: 'custitem_site_price_inc_vat'
                    }
                );

                var oldTaxScheduleId = oldItem.getValue({
                        fieldId: 'taxschedule'
                    }
                );
            } else {
                oldSitePrice = -1
                oldTaxScheduleId = -1
            }

            log.debug('Running', [oldSitePrice, sitePrice])

            const taxScheduleId = itemFromWorkflow.getValue({
                    fieldId: 'taxschedule'
                }
            );


            if (oldSitePrice === sitePrice && oldTaxScheduleId === taxScheduleId) {
                log.debug('Nothing to do', context.newRecord.id)
                return;}

            let taxRate = 0;

            const myScript = runtime.getCurrentScript();
            const stdRateVat = myScript.getParameter({
                name: 'custscript_std_vat_rate'
            });
            const stdRateSchedule = myScript.getParameter({
                name: 'custscript_std_rate_schedule'
            });
            const reducedRateVat = myScript.getParameter({
                name: 'custscript_reduced_vat_rate'
            });
            const reducedRateSchedule = myScript.getParameter({
                name: 'custscript_reduced_rate_schedule'
            });

            log.debug('tax schedules', [taxScheduleId, stdRateSchedule, reducedRateSchedule])

            switch(taxScheduleId) {
                case stdRateSchedule:
                    taxRate = stdRateVat;
                    break;
                case reducedRateSchedule:
                    taxRate = reducedRateVat;
                    break;
                default:
                    taxRate = 0;
            }

            const basePrice = sitePrice / ((100 + taxRate) / 100);

            // assuming that Base Price is row 0 column 0 and GBP is matrix 1.

            itemFromWorkflow.setMatrixSublistValue({
                sublistId: 'price1',
                fieldId: 'price',
                line: 0,
                column: 0,
                value: basePrice
            });

            // var result = item.save();

            return;
        }

        // Add the return statement that identifies the entry point functions.
        return {
            beforeSubmit: beforeSubmit
        };
    });