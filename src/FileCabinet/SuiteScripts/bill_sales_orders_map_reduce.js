/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

// Create Invoices from SOs in a SS

define(['N/search', 'N/record', 'N/redirect', 'N/runtime'],
    function (search, record, redirect, runtime) {


        function getInputData() {

            var searchName = runtime.getCurrentScript().getParameter('custscript_searchname');

            var soSearch = search.load({
                id: searchName
            });
            
            log.debug('Search using', searchName);
            log.debug('Search results', soSearch);

            return soSearch;
        }

        function map(context){

            log.debug('Map context', context);

            var internalId;
            var internalidJson;
            var soDateText;
            var data;

            data = JSON.parse(context.value);

            internalidJson = data.values['GROUP(internalid)'];

            internalId = internalidJson['value'];

            soDateText = data.values['GROUP(trandate)'];

            log.debug('Map output', [internalId, soDateText])

            context.write({
                key: internalId,
                value: soDateText
            });

            return

        }

        function reduce(context) {

            log.debug('Reduce context', context);

            var day;
            var year;
            var month;
            var invoice;
            var recordId;
            var soDate;
            var internalId;
            var newsoDate;

            internalId = context.key;
            soDate = context.values[0];

            log.debug('To process', [internalId, soDate]);

            year = parseInt(soDate.substring(6), 10);
            day = parseInt(soDate.substring(0, 2), 10);
            month = parseInt(soDate.substring(3, 6), 10) - 1;

            log.debug('date breakdown', [year, month, day]);

            newsoDate = new Date(year, month, day);

            log.debug('date ', newsoDate);

            invoice = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: internalId,
                toType: record.Type.INVOICE,
                isDynamic: false
            });

            log.debug('Invoice', invoice);

            invoice.setValue({
                    fieldId: 'trandate',
                    value: newsoDate,
                    ignoreFieldChange: true
                });

            log.debug('Altered Invoice', invoice);

            try {
                recordId = invoice.save();
            }

            catch(err){
                log.error('Save failed', err);
            }

            log.debug('Invoice saved', recordId);

            return

        }

        function summarize(summary){


            var type = summary.toString();
            log.audit(type + ' Usage Consumed', summary.usage);
            log.audit(type + ' Concurrency Number ', summary.concurrency);
            log.audit(type + ' Number of Yields', summary.yields);


        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        }
    });
