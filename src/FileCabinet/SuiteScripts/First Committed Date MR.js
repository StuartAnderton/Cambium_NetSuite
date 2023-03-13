/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

// Create Invoices from SOs in a SS

define(['N/search', 'N/record', 'N/redirect', 'N/runtime', 'N/format'],
    function (search, record, redirect, runtime, format) {


        function getInputData() {

            // var searchName = runtime.getCurrentScript().getParameter('custscript_searchname');

            var soSearch = search.load({
                id: 'customsearch_first_committed_lists_2'
            });


            return soSearch;
        }

        function map(context) {

            log.debug('Map context', context);

            var internalId;
            var soDateText;
            var data;

            data = JSON.parse(context.value);

            var values = data.values;

            var entity = values['GROUP(entity)'];

            var name = entity.value;

            log.debug('Map name', name)


            const transactionSearchColInternalId = search.createColumn({ name: 'internalid', summary: search.Summary.GROUP });
            const transactionSearch = search.create({
                type: 'transaction',
                filters: [
                    ['trandate', 'onorafter', '06/09/2021'],
                    'AND',
                    ['name', 'anyof', name],
                    'AND',
                    ['custcol_first_committed', 'isempty', ''],
                    'AND',
                    ['linesystemnotes.field', 'anyof', 'CUSTCOL_LAST_COMMITTED_QUANTITY'],
                    'AND',
                    ['formulanumeric: TO_NUMBER({linesystemnotes.newvalue})', 'greaterthan', '0'],
                    'AND',
                    [
                        ['linesystemnotes.oldvalue', 'is', '0'],
                        'OR',
                        ['linesystemnotes.oldvalue', 'isempty', ''],
                    ],
                ],
                columns: [
                    transactionSearchColInternalId,
                ],
            });


            var transactionSearchPagedData = transactionSearch.runPaged({pageSize: 1000});

            for (var i = 0; i < transactionSearchPagedData.pageRanges.length; i++) {
                var transactionSearchPage = transactionSearchPagedData.fetch({index: i});

                transactionSearchPage.data.forEach(function (result) {

                    log.debug('Map result', result)

                    var internalid = result.getValue(transactionSearchColInternalId);

                    log.debug('Map output', ['internalId', internalid])

                    context.write({
                        key: internalid,
                        value: internalid
                    });


                });
            }


            /**
             * Process results into an object
             */


            return

        }

        function reduce(context) {

            log.debug('Reduce context', context);


            var internalId = context.key;

            log.debug('Internalid', internalId);


            const transactionSearchColDocumentNumber = search.createColumn({ name: 'tranid', summary: search.Summary.GROUP });
            const transactionSearchColName = search.createColumn({ name: 'entity', summary: search.Summary.GROUP });
            const transactionSearchColLineId = search.createColumn({ name: 'lineuniquekey', summary: search.Summary.GROUP });
            const transactionSearchColItem = search.createColumn({ name: 'item', summary: search.Summary.GROUP });
            const transactionSearchColSoReceived = search.createColumn({ name: 'trandate', summary: search.Summary.GROUP });
            const transactionSearchColFormulaDateXR1YQQI9 = search.createColumn({ name: 'formuladate', summary: search.Summary.MIN, formula: 'TO_DATE({linesystemnotes.date})' });
            const transactionSearchColFirstCommitted = search.createColumn({ name: 'custcol_first_committed', summary: search.Summary.GROUP });
            const transactionSearchColInternalId = search.createColumn({ name: 'internalid', summary: search.Summary.GROUP });
            const transactionSearch = search.create({
                type: 'transaction',
                filters: [
                    ['trandate', 'onorafter', '06/09/2021'],
                    'AND',
                    ['linesystemnotes.field', 'anyof', 'CUSTCOL_LAST_COMMITTED_QUANTITY'],
                    'AND',
                    ['internalid', 'anyof', internalId],
                    'AND',
                    ['custcol_first_committed', 'isempty', ''],
                    'AND',
                    ['formulanumeric: TO_NUMBER({linesystemnotes.newvalue})', 'greaterthan', '0'],
                    'AND',
                    [
                        ['linesystemnotes.oldvalue', 'is', '0'],
                        'OR',
                        ['linesystemnotes.oldvalue', 'isempty', ''],
                    ],
                ],
                columns: [
                    transactionSearchColDocumentNumber,
                    transactionSearchColName,
                    transactionSearchColLineId,
                    transactionSearchColItem,
                    transactionSearchColSoReceived,
                    transactionSearchColFormulaDateXR1YQQI9,
                    transactionSearchColFirstCommitted,
                    transactionSearchColInternalId,
                ],
            });



            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: internalId
            });

            log.debug('sales order', salesOrder)

            var transactionSearchPagedData = transactionSearch.runPaged({pageSize: 1000});

            for (var i = 0; i < transactionSearchPagedData.pageRanges.length; i++) {
                var transactionSearchPage = transactionSearchPagedData.fetch({index: i});
                transactionSearchPage.data.forEach(function (result) {
                    log.debug('reduce result', result)
                    var item = result.getValue(transactionSearchColItem);
                    log.debug('item', item)
                    var firstCommitted = result.getValue(transactionSearchColFormulaDateXR1YQQI9);
                    var lineUniqueKey = result.getValue(transactionSearchColLineId);
                    log.debug('lineUniqueKey', lineUniqueKey)

                    var lineNumber = salesOrder.findSublistLineWithValue({
                        sublistId: 'item',
                        fieldId: 'lineuniquekey',
                        value: lineUniqueKey
                    })

                    log.debug('lineNumber', lineNumber)

                    var testItem = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: lineNumber
                    });

                    log.debug('testitem', testItem)



                    log.debug('Line', lineNumber)

                    if (testItem == item) {

                        log.debug('First Committed', firstCommitted)

                        var formattedDate = format.parse({
                            value: firstCommitted,
                            type: format.Type.DATE
                        });

                        log.debug('First Committed parsed', formattedDate)

                        salesOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_first_committed',
                            line: lineNumber,
                            value: formattedDate
                        });

                        log.debug('Sublist set', lineNumber)
                    } else {
                        log.error('Line ID mismatch', [testItem, result])
                    }



                })


            }

            log.debug('Before save')

            var salesOrderId = salesOrder.save();

            log.audit('Set First committed on ', salesOrderId)
        }

        function summarize(summary) {


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
    }
);
