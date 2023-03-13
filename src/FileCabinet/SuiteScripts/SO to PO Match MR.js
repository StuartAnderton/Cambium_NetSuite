/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */

// Match Sales Order lines to the PO which will probably fulfil them

define(['N/search', 'N/record', 'N/redirect', 'N/runtime', 'N/format'],
    function (search, record, redirect, runtime, format) {


        function getInputData() {
            // Get list of Items with open SOs as input

            var itemSearchResults = [];
            var i = 0;
            var itemCount = 0;
            var salesorderSearchColItem = search.createColumn({name: 'item', summary: search.Summary.GROUP});
            var salesorderSearchColLineLastModified = search.createColumn({
                name: 'linelastmodifieddate',
                summary: search.Summary.MAX,
                sort: search.Sort.ASC
            });


            var salesorderSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    'AND',
                    ['formulanumeric: {quantity} - NVL({quantitycommitted}, 0) - NVL({quantityshiprecv}, 0)', 'greaterthan', '0'],
                    'AND',
                    ['purchaseorder', 'anyof', '@NONE@'],
                    'AND',
                    ['subsidiary', 'anyof', '1']
                ],
                columns: [
                    salesorderSearchColItem,
                    salesorderSearchColLineLastModified
                ]
            });

            var salesorderSearchPagedData = salesorderSearch.runPaged({pageSize: 1000});
            for (i = 0; i < salesorderSearchPagedData.pageRanges.length; i++) {
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

            var itemId = context.value;

            /**
             * -- Get SS of open SOs for this Item
             * -- Set SS of open POs for this Item
             * -- For each line on SO, work out its rank in order of amended for that item
             * -- For each line on PO, work out its rank in order of expected delivery for that item
             * -- Work out which PO is likely to include the SO
             * -- Store result in SO
             * -- Blank any previous matches which no longer match
             */

            var testFlag = false;
            var i = 0;
            var j = 0;

            /**
             *  GET SALES ORDERS
             */

            var solSearch = search.load({
                id: 'customsearch_open_sales_orders'
            });
            var solSearchResults = [];
            var defaultFilters = solSearch.filters;

            defaultFilters.push(search.createFilter({
                name: 'item',
                operator: search.Operator.ANYOF,
                values: itemId
            }));

            solSearch.filters = defaultFilters;

            var solPaged = solSearch.runPaged({
                pageSize: 1000
            });
            solPaged.pageRanges.forEach(function (pageRange) {
                var myPage = solPaged.fetch({index: pageRange.index});

                myPage.data.forEach(function (result) {
                    var tempObj = {};
                    tempObj.internalid = result.getValue({
                        name: 'internalid'
                    }).valueOf();
                    tempObj.added_date = result.getValue({
                        name: 'custcol_item_added_date'
                    });
                    tempObj.item = result.getValue({
                        name: 'item'
                    });
                    tempObj.line = result.getValue({
                        name: 'linesequencenumber'
                    }).valueOf() - 1;
                    tempObj.quantity = result.getValue({
                        name: 'formulanumeric'
                    }).valueOf();
                    tempObj.rank = 0;
                    tempObj.po_date = result.getValue({
                        name: 'custcol_prob_po_date'
                    });
                    tempObj.po_name = result.getValue({
                        name: 'custcol_prob_po_number'
                    });
                    tempObj.supplier_id = result.getValue({
                        name: 'vendor',
                        join: 'item'
                    });
                    tempObj.expected_date = result.getValue({
                        name: 'custcol_expected_into_warehouse'
                    });
                    tempObj.order_id = result.getValue({
                        name: 'custcol_originating_list_purchase_id'
                    });
                    tempObj.modified_by_agent = result.getValue({
                        name: 'custcol_modified_by_agent'
                    });
                    solSearchResults.push(tempObj);
                    /*return true;*/
                });
            });

            /**
             *  GET PURCHASE ORDERS
             */

            var polSearch = search.load({
                id: 'customsearch_open_purchase_orders'
            });
            var polSearchResults = [];
            defaultFilters = polSearch.filters;
            defaultFilters.push(search.createFilter({
                name: 'item',
                operator: search.Operator.ANYOF,
                values: itemId
            }));
            polSearch.filters = defaultFilters;

            var polPaged = polSearch.runPaged({
                pageSize: 1000
            });
            polPaged.pageRanges.forEach(function (pageRange) {
                var myPolPage = polPaged.fetch({index: pageRange.index});

                myPolPage.data.forEach(function (result) {

                    var tempObj = {};
                    tempObj.internalid = result.getValue({
                        name: 'internalid'
                    }).valueOf();
                    tempObj.added_date = result.getValue({
                        name: 'custcol_item_added_date'
                    });
                    tempObj.item = result.getValue({
                        name: 'item'
                    });
                    tempObj.quantity = result.getValue({
                        name: 'formulanumeric'
                    }).valueOf();
                    tempObj.rank = 0;
                    tempObj.po_name = result.getValue({
                        name: 'tranid'
                    });
                    tempObj.approved_date = result.getValue({
                        name: 'custbody_date_approved'
                    });
                    tempObj.expected_date = result.getValue({
                        name: 'expectedreceiptdate'
                    });
                    tempObj.modified_by_agent = result.getValue({
                        name: 'custcol_modified_by_agent'
                    });
                    polSearchResults.push(tempObj);
                    /*return true;*/
                });
            });

            /**
             *  Calculate rankings (quantity ordered of that item on or before the date of the line in question)
             */

            for (i in solSearchResults) {

                var ranking = 0;

                for (j = 0; j <= i; j++) {
                    ranking += parseInt(solSearchResults[j].quantity, 10);
                }

                solSearchResults[i].rank = ranking;
            }

            for (i in polSearchResults) {

                ranking = 0;

                for (j = 0; j <= i; j++) {
                    ranking = ranking + parseInt(polSearchResults[j].quantity, 10);
                }

                polSearchResults[i].rank = ranking;
            }

            /**
             * PROCESS SOs
             */

            var posForItem = polSearchResults;

            for (i in solSearchResults) {

                /**
                 * Loop through POs to find the one which can fulfill the SO
                 */

                var resultMatch = false;


                for (j in posForItem) {

                    if (posForItem[j].rank >= solSearchResults[i].rank) {

                        resultMatch = true;

                        log.debug('PO details', posForItem[j]);
                        log.debug('SO line details', solSearchResults[i]);

                        if (solSearchResults[i].po_name === posForItem[j].po_name &&
                            solSearchResults[i].expected_date === posForItem[j].expected_date &&
                            solSearchResults[i].modified_by_agent === posForItem[j].modified_by_agent &&
                            !testFlag) {

                            log.debug('Matched PO, no change needed', solSearchResults[i]);


                        } else {
                            salesOrderId = solSearchResults[i].internalid
                            var poDate = posForItem[j].approved_date;
                            var poName = posForItem[j].po_name;
                            var expectedDate = posForItem[j].expected_date;
                            var orderLine = solSearchResults[i].line;
                            var orderId = solSearchResults[i].order_id;
                            var modifiedByAgent = posForItem[j].modified_by_agent;

                            details = [orderLine, poDate, poName, expectedDate, itemId, orderId, modifiedByAgent];

                            context.write({
                                key: salesOrderId,
                                value: details.toString()
                            })

                            log.audit('Matched PO, updating SO int id ' + salesOrderId, [details, solSearchResults[i].modified_by_agent])

                        }
                        break

                    }
                }


                if (!resultMatch) {

                    /**
                     *  Blank any old entries
                     */

                    if (solSearchResults[i].po_date || solSearchResults[i].po_name || solSearchResults[i].expected_date) {

                        log.audit('Not matched, Clearing old value on SO int id ' + salesOrderId, solSearchResults[i]);

                        var salesOrderId = solSearchResults[i].internalid;
                        orderId = solSearchResults[i].order_id;
                        var soLine = solSearchResults[i].line;

                        var details = [soLine, '', '', '', itemId, orderId, ''];

                        context.write({
                            key: salesOrderId,
                            value: details.toString()
                        })


                    }
                } else {
                    /** log.debug('Not matched PO, No action required', solSearchResults[i]); **/
                }
            }
        }


        function reduce(context) {

            // Modify the SO line as required

            log.debug('Reduce context', context);

            var lineDetails = '';
            var soLine = '';
            var poDate = '';
            var poName = '';
            var expectedDate = '';
            var itemId;
            var orderId;
            var modifiedByAgent;
            var modifiedByAgentBool = false;

            var salesOrderId = context.key;
            var linesToChange = context.values;


            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId,
                isDynamic: false
            });

            log.debug('Loaded record', salesOrder);


            log.debug('Lines to change', linesToChange);


            linesToChange.forEach(function (line) {


                lineDetails = line.split(',');
                soLine = lineDetails[0];
                poDate = lineDetails[1];
                poName = lineDetails[2];
                expectedDate = lineDetails[3];
                itemId = lineDetails[4];
                orderId = lineDetails[5];
                modifiedByAgent = lineDetails[6];

                if (modifiedByAgent == 'true') {
                    modifiedByAgentBool = true
                } else {
                    modifiedByAgentBool = false
                }

                log.debug('SO line details', lineDetails);
                log.debug('ExpectedDate', expectedDate);

                var lineCheck = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: soLine
                });

                // Because of misnumbering caused by kits on a SO we need to check we have the right line
                // Try to use originating order id, if missing use Item
                // Item can fail if two lines for same product on SO.

                if (itemId != lineCheck) {
                    log.audit(itemId + ' does not match ' + lineCheck + ' on SO ' + salesOrderId, lineDetails)

                    if (!orderId) {
                        soLine = salesOrder.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            value: itemId
                        })
                    } else {
                        soLine = salesOrder.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: 'custcol_originating_list_purchase_id',
                            value: orderId
                        })
                    }

                    log.debug('Replacing with', soLine)

                }

                if (soLine) {

                    log.debug('Updating line' + soLine, poDate + ' ' + poName + ' ' + expectedDate + ' ' + modifiedByAgent)

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_prob_po_date',
                        line: soLine,
                        value: poDate
                    });

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_prob_po_number',
                        line: soLine,
                        value: poName
                    });

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_expected_into_warehouse',
                        line: soLine,
                        value: expectedDate
                    });

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_modified_by_agent',
                        line: soLine,
                        value: modifiedByAgentBool
                    });

                    try {

                        var firstPO = salesOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_first_ordered',
                            line: soLine
                        });


                        if (!firstPO && poDate) {

                            var parsedPoDate = format.parse({
                                value: poDate,
                                type: format.Type.DATETIME
                            });

                            salesOrder.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_first_ordered',
                                line: soLine,
                                value: parsedPoDate
                            });
                        }
                    } catch (err) {
                        log.error('First PO error', err)
                    }
                }
            })

            salesOrder.setValue({
                fieldId: 'custbody_po_match_updated',
                value: new Date()
            });

            try {
                var id = salesOrder.save();
                log.audit('Record saved, updated ' + salesOrderId, linesToChange);
            } catch (err) {
                log.error('Save failed');
                log.error('Error', err);
            }


        }

        function summarize(summary) {


            var type = summary.toString();
            log.audit(type + ' Usage Consumed', summary.usage);
            log.audit(type + ' Concurrency Number ', summary.concurrency);
            log.audit(type + ' Number of Yields', summary.yields);
            log.audit(type + ' Input stage', summary.inputSummary);
            log.audit(type + ' Map stage', summary.mapSummary);
            log.audit(type + ' Reduce stage', summary.reduceSummary);


        }

        return {

            config: {
                retryCount: 3
            },
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        }
    });
