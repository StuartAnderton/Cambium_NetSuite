/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

// Match Sales Order lines to the PO which will probably fulfil them

define(['N/search', 'N/record', 'N/redirect', 'N/runtime'],
    function (search, record, redirect, runtime) {


        function getInputData() {
            // Get list of Items with open SOs in the intial load as input

            var itemSearchResults = [];
            var i = 0;
            var itemCount = 0;
            var salesorderSearchColItem = search.createColumn({name: 'item', summary: search.Summary.GROUP});
            var salesorderSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['formulanumeric: {quantity} - {quantityshiprecv}', 'greaterthan', '0'],
                    'AND',
                    ['formulanumeric: CASE WHEN {trandate} - TO_DATE(\'2017-01-01\', \'YYYY-MM-DD\')  < 0 THEN 1 WHEN {customer.custentity_bb1_del_date} -TO_DATE(\'2021-09-30\', \'YYYY-MM-DD\')  > 0 THEN 1 WHEN {customer.custentity_bb1_warehouse_status} = \'Ready to Send\' THEN 1 WHEN REGEXP_SUBSTR({externalid}, \'InitialOutstanding\') = \'InitialOutstanding\'  THEN {custcol_originating_list_purchase_id} WHEN {trandate} - TO_DATE(\'2021-09-01\', \'YYYY-MM-DD\')  > 0 THEN 1000000 WHEN {customer.custentity_owning_brand} = \'Cambium : The Wedding Shop\' THEN  {custcol_originating_list_purchase_id} WHEN {customer.custentity_owning_brand} = \'Cambium : Wedding Present Company\' THEN  {custcol_originating_list_purchase_id} WHEN {customer.custentity_owning_brand} = \'Cambium : Prezola\' AND NVL({quantitycommitted}, 0) > 0  AND TO_DATE(\'2021-08-31\', \'YYYY-MM-DD\') > {custcol_last_committed_date} THEN 1 ELSE 1000000 END   - {orderpriority}', 'notequalto', '0'],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    //'AND',
                    //['commit', 'anyof', '3'],
                    //'AND',
                    //['externalidstring', 'contains', 'InitialOutstanding'],
                    'AND',
                    ['item.isdropshipitem', 'is', 'F'],
                    'AND',
                    ['item.isspecialorderitem', 'is', 'F']
                ],
                columns: [
                    salesorderSearchColItem
                ]
            });

            var salesorderSearchPagedData = salesorderSearch.runPaged({pageSize: 1000});
            for (i = 0; i < salesorderSearchPagedData.pageRanges.length; i++) {
                //for (i = 0; i < 1; i++) {
                var salesorderSearchPage = salesorderSearchPagedData.fetch({index: i});
                salesorderSearchPage.data.forEach(function (result) {
                    var item = result.getValue(salesorderSearchColItem);
                    itemSearchResults.push(item);
                    itemCount = itemCount + 1;
                });
            }
            log.audit('Found Items', itemCount);
            return itemSearchResults;
        }

        function map(context) {

            // Match SOs and POs for that Item

            log.debug('Map context', context);


            context.write({
                key: context.key,
                value: context.value
            })

            return


        }


        function reduce(context) {
            // Match SOs and POs for that Item

            log.audit('Reduce context', context);

            var itemId = context.values[0];

            log.debug('Processing', itemId);

            var solSearchResults = [];

            /**
             *  GET SALES ORDERS
             */

            var salesorderSearchColItem = search.createColumn({name: 'item'});
            var salesorderSearchColOriginatingIdLpod = search.createColumn({name: 'custcol_originating_list_purchase_id'});
            var salesorderSearchColInternalId = search.createColumn({name: 'internalid'});
            var salesorderSearchColFormulaNumericXMHYRM8P = search.createColumn({
                name: 'formulanumeric',
                formula: 'CASE WHEN {trandate} - TO_DATE(\'2017-01-01\', \'YYYY-MM-DD\')  < 0 THEN 1 WHEN {customer.custentity_bb1_del_date} -TO_DATE(\'2021-09-30\', \'YYYY-MM-DD\')  > 0 THEN 1 WHEN {customer.custentity_bb1_warehouse_status} = \'Ready to Send\' THEN 1 WHEN REGEXP_SUBSTR({externalid}, \'InitialOutstanding\') = \'InitialOutstanding\'  THEN {custcol_originating_list_purchase_id} WHEN {trandate} - TO_DATE(\'2021-09-01\', \'YYYY-MM-DD\')  > 0 THEN 1000000 WHEN {customer.custentity_owning_brand} = \'Cambium : The Wedding Shop\' THEN  {custcol_originating_list_purchase_id} WHEN {customer.custentity_owning_brand} = \'Cambium : Wedding Present Company\' THEN  {custcol_originating_list_purchase_id} WHEN {customer.custentity_owning_brand} = \'Cambium : Prezola\' AND NVL({quantitycommitted}, 0) > 0  AND TO_DATE(\'2021-08-31\', \'YYYY-MM-DD\') > {custcol_last_committed_date} THEN 1 ELSE 1000000 END   ',
                sort: search.Sort.DESC
            });

            var salesorderSearchColQuantity = search.createColumn({name: 'quantity'});
            var salesorderSearchColQuantityCommitted = search.createColumn({name: 'quantitycommitted'});
            var salesorderSearchColQuantityFulfilledreceived = search.createColumn({name: 'quantityshiprecv'});


            var solSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['formulanumeric: {quantity} - {quantityshiprecv}', 'greaterthan', '0'],
                    'AND',
                    ['formulanumeric: CASE WHEN {trandate} - TO_DATE(\'2017-01-01\', \'YYYY-MM-DD\')  < 0 THEN 1 WHEN {customer.custentity_bb1_del_date} -TO_DATE(\'2021-09-30\', \'YYYY-MM-DD\')  > 0 THEN 1 WHEN {customer.custentity_bb1_warehouse_status} = \'Ready to Send\' THEN 1 WHEN REGEXP_SUBSTR({externalid}, \'InitialOutstanding\') = \'InitialOutstanding\'  THEN {custcol_originating_list_purchase_id} WHEN {trandate} - TO_DATE(\'2021-09-01\', \'YYYY-MM-DD\')  > 0 THEN 1000000 WHEN {customer.custentity_owning_brand} = \'Cambium : The Wedding Shop\' THEN  {custcol_originating_list_purchase_id} WHEN {customer.custentity_owning_brand} = \'Cambium : Wedding Present Company\' THEN  {custcol_originating_list_purchase_id} WHEN {customer.custentity_owning_brand} = \'Cambium : Prezola\' AND NVL({quantitycommitted}, 0) > 0  AND TO_DATE(\'2021-08-31\', \'YYYY-MM-DD\') > {custcol_last_committed_date} THEN 1 ELSE 1000000 END   - {orderpriority}', 'notequalto', '0'], 'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    'AND',
                    ['item', 'anyof', itemId],
                    'AND',
                    ['custcol_originating_list_purchase_id', 'isnotempty', ''],

                ],
                columns: [
                    salesorderSearchColItem,
                    salesorderSearchColOriginatingIdLpod,
                    salesorderSearchColInternalId,
                    salesorderSearchColFormulaNumericXMHYRM8P,
                    salesorderSearchColQuantity,
                    salesorderSearchColQuantityCommitted,
                    salesorderSearchColQuantityFulfilledreceived

                ],
            });


            var solPaged = solSearch.runPaged({
                pageSize: 1000
            });
            solPaged.pageRanges.forEach(function (pageRange) {
                var myPage = solPaged.fetch({index: pageRange.index});

                myPage.data.forEach(function (result) {
                    var tempObj = {};
                    var committed = result.getValue(salesorderSearchColQuantityCommitted) | 0;
                    var quantity = result.getValue(salesorderSearchColQuantity) | 0;
                    var fulfilled = result.getValue(salesorderSearchColQuantityFulfilledreceived) | 0;
                    if (committed > 0 && (quantity - committed - fulfilled) == 0) {
                        tempObj.complete = true
                    } else {
                        tempObj.complete = false
                    }
                    tempObj.item = result.getValue(salesorderSearchColItem);
                    tempObj.originatingIdLpod = result.getValue(salesorderSearchColOriginatingIdLpod);
                    tempObj.internalId = result.getValue(salesorderSearchColInternalId);
                    tempObj.priority = result.getValue(salesorderSearchColFormulaNumericXMHYRM8P);
                    tempObj.line = 0;
                    solSearchResults.push(tempObj);
                    log.debug('Iterating', tempObj)
                });
            });


            for (var i in solSearchResults) {

                /*if (solSearchResults[i].complete && solSearchResults[i].priority == 1000000) {
                    log.audit('Complete & top priority no uncommit', solSearchResults[i])
                    break;
                }*/

                var salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: solSearchResults[i].internalId,
                    isDynamic: false
                });

                var soLine = salesOrder.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'custcol_originating_list_purchase_id',
                    value: solSearchResults[i].originatingIdLpod
                });

                solSearchResults[i].line = soLine;

                var setPriority = salesOrder.getSublistValue({
                    sublistId: 'item',
                    line: soLine,
                    fieldId: 'orderpriority'
                });

                if (setPriority != solSearchResults[i].priority) {

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        line: soLine,
                        fieldId: 'orderpriority',
                        value: solSearchResults[i].priority
                    });

                    log.debug('Setting priority', solSearchResults[i])

                    try {
                        var id = salesOrder.save();
                        log.audit('Record saved, updated priority ' + solSearchResults[i].internalId, solSearchResults[i]);
                    } catch (err) {
                        log.error('Save failed');
                        log.error('Error', err);
                    }
                } else {
                    log.audit('No change required on ' + solSearchResults[i].internalId, solSearchResults[i])
                }

            }

            /*for (i in solSearchResults) {

                var salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: solSearchResults[i].internalId,
                    isDynamic: false
                });

                soLine = solSearchResults[i].line;

                salesOrder.setSublistValue({
                    sublistId: 'item',
                    line: soLine,
                    fieldId: 'commitinventory',
                    value: 1
                });
                if (solSearchResults[i].priority != 0) {
                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        line: soLine,
                        fieldId: 'orderpriority',
                        value: solSearchResults[i].priority
                    });
                }

                log.debug('Setting', solSearchResults[i])

                try {
                    var id = salesOrder.save();
                    log.audit('Record saved, committed ' + solSearchResults[i].internalId, solSearchResults[i]);
                } catch (err) {
                    log.error('Save failed');
                    log.error('Error', err);
                }

            }*/


        }

        function summarize(summary) {


            var type = summary.toString();
            log.audit(type + ' Usage Consumed', summary.usage);
            log.audit(type + ' Concurrency Number ', summary.concurrency);
            log.audit(type + ' Number of Yields', summary.yields);
            log.audit(type + ' Input stage', summary.inputSummary);
            log.audit(type + ' Map stage', summary.mapSummary);


        }

        return {

            config: {
                retryCount: 0
            },
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        }
    });
