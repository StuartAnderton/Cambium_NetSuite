/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define([ 'N/record', 'N/search', 'N/format' ],
    /**
     * @param {record}
     *            record
     * @param {search}
     *            search
     */
    function(record, search, format) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object}
         *            scriptContext
         * @param {string}
         *            scriptContext.type - The context in which the script is
         *            executed. It is one of the values from the
         *            scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(scriptContext) {

            var transactionSearchColDocumentNumber = search.createColumn({ name: 'tranid' });
            var transactionSearchColName = search.createColumn({ name: 'entity' });
            var transactionSearchColLineId = search.createColumn({ name: 'line' });
            var transactionSearchColItem = search.createColumn({ name: 'item' });
            var transactionSearchColSoReceived = search.createColumn({ name: 'trandate' });
            var transactionSearchColFirstCommitted = search.createColumn({ name: 'formuladate', formula: 'TO_DATE({linesystemnotes.date})' });
            var transactionSearchColCustcolFirstCommitted = search.createColumn({ name: 'custcol_first_committed' });
            var transactionSearchColInternalId = search.createColumn({ name: 'internalid' });
            var transactionSearch = search.create({
                type: 'transaction',
                filters: [
                    ['linesystemnotes.field', 'anyof', 'CUSTCOL_LAST_COMMITTED_DATE'],
                    'AND',
                    ['linesystemnotes.oldvalue', 'isempty', ''],
                    'AND',
                    ['trandate', 'onorafter', '01/10/2022'],
                    'AND',
                    ['custcol_first_committed', 'isempty', ''],
                ],
                columns: [
                    transactionSearchColDocumentNumber,
                    transactionSearchColName,
                    transactionSearchColLineId,
                    transactionSearchColItem,
                    transactionSearchColSoReceived,
                    transactionSearchColFirstCommitted,
                    transactionSearchColCustcolFirstCommitted,
                    transactionSearchColInternalId
                ],
            });

            var transactionSearchPagedData = transactionSearch.runPaged({ pageSize: 1000 });

            for (var i = 0; i < transactionSearchPagedData.pageRanges.length; i++) {
                var transactionSearchPage = transactionSearchPagedData.fetch({ index: i });
                transactionSearchPage.data.forEach(function (result)  {
                    var documentNumber = result.getValue(transactionSearchColDocumentNumber);
                    var name = result.getValue(transactionSearchColName);
                    var lineId = result.getValue(transactionSearchColLineId);
                    var item = result.getValue(transactionSearchColItem);
                    var soReceived = result.getValue(transactionSearchColSoReceived);
                    var firstCommitted = result.getValue(transactionSearchColFirstCommitted);
                    var custcolFirstCommitted = result.getValue(transactionSearchColCustcolFirstCommitted);
                    var internalId = result.getValue(transactionSearchColInternalId);


                    var salesOrder = record.load({
                        type: record.Type.SALES_ORDER,
                        id: internalId
                    });

                    var lineNumber = salesOrder.findSublistLineWithValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: item
                    });

                    log.debug('First Committed', firstCommitted)

                    var formattedDate =  format.parse({
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
                    
                    salesOrder.save();

                    log.audit('Set First committed on ' + documentNumber, [item, formattedDate])


                });
            }


        }

        return {
            execute : execute
        };

    });
