/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */


/**
 * First attempt to match a SO to the PO likely to have been triggered by it
 *
 */

define(['N/record', 'N/search', 'N/format'],


    function (record, search, format) {


        function execute(scriptContext) {


            /**
             * -- Get SS of open SOs
             * -- Set SS of open POs containing those items
             * -- For each line on SO, work out its rank in order of amended for that item
             * -- Por each line on PO, work out its rank in order of expected delivery for that item
             * -- Work out which PO is likely to include the SO
             * -- Store result in SO
             * -- Blank any previous matches which no longer match
             */

            var testFlag = false;

            /**
             *  GET SALES ORDERS
             */

            var solSearch = search.load({
                id: 'customsearch_open_sales_orders'
            });
            var solSearchResults = [];
            var defaultFilters = solSearch.filters;
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
                    solSearchResults.push(tempObj);
                    /*return true;*/
                });
            });


            /**
             * Get distinct product IDs from SOs
             */

            var solUniqueProductIds = get_unique_values_from_array_object(solSearchResults, 'item');

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
                values: solUniqueProductIds
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

                    if (solSearchResults[i].item === solSearchResults[j].item) {
                        ranking += parseInt(solSearchResults[j].quantity, 10);
                    }

                }

                solSearchResults[i].rank = ranking;
            }

            for (i in polSearchResults) {

                ranking = 0;

                for (j = 0; j <= i; j++) {

                    if (polSearchResults[i].item === polSearchResults[j].item) {
                        ranking = ranking + parseInt(polSearchResults[j].quantity, 10);
                    }

                }

                polSearchResults[i].rank = ranking;
            }

            /**
             * PROCESS SOs
             */

            for (i in solSearchResults) {

                /**
                 * Loop through POs to find the one which can fulfill the SO
                 */

                var posForItem = polSearchResults.filter(function (el) {
                    return el.item === solSearchResults[i].item;
                });

                var resultMatch = false;

                if (posForItem) {

                    for (j in posForItem) {

                        if (posForItem[j].rank >= solSearchResults[i].rank) {


                            resultMatch = true;

                            log.debug('PO details', posForItem[j]);
                            log.debug('SO line details', solSearchResults[i]);

                            /**

                             var poDate = format.parse({
                                value: posForItem[j].expected_date,
                                type: format.Type.DATE
                            });

                             var soDate = format.parse({
                                value: solSearchResults[i].expected_date,
                                type: format.Type.DATE
                            });
                             *
                             */

                            if (solSearchResults[i].po_name == posForItem[j].po_name &&
                                solSearchResults[i].expected_date == posForItem[j].expected_date &&
                                !testFlag) {

                                log.debug('Matched PO, no change needed', solSearchResults[i]);

                            } else {
                                solSearchResults[i].po_date = posForItem[j].approved_date;
                                solSearchResults[i].po_name = posForItem[j].po_name;
                                solSearchResults[i].expected_date = posForItem[j].expected_date;

                                /**
                                 * save result in SO
                                 */

                                var salesOrder = record.load({
                                    type: record.Type.SALES_ORDER,
                                    id: solSearchResults[i].internalid,
                                    isDynamic: false
                                });

                                log.debug('Loaded record', salesOrder);
                                log.debug('PO details', posForItem[j]);
                                log.debug('SO line details', solSearchResults[i]);


                                existingValue = salesOrder.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: solSearchResults[i].line.toFixed()
                                });

                                log.debug('Existing PO item on line', [solSearchResults[i].line.toFixed(), existingValue]);

                                if (!existingValue || existingValue != solSearchResults[i].item) {

                                    log.error('Line match failed', [solSearchResults[i].line.toFixed(), existingValue, solSearchResults[i]]);

                                } else {

                                    salesOrder.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_prob_po_date',
                                        line: solSearchResults[i].line.toFixed(),
                                        value: solSearchResults[i].po_date
                                    });

                                    salesOrder.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_prob_po_number',
                                        line: solSearchResults[i].line.toFixed(),
                                        value: solSearchResults[i].po_name
                                    });

                                    salesOrder.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_expected_into_warehouse',
                                        line: solSearchResults[i].line.toFixed(),
                                        value: solSearchResults[i].expected_date
                                    });

                                    try {
                                        var id = salesOrder.save();
                                        log.audit('Matched PO, updated, sol', solSearchResults[i]);
                                    } catch (err) {
                                        log.error('Matched PO, save failed');
                                        log.error('Error', err);
                                    }
                                }
                            }

                            break;
                        }
                    }
                }

                if (!resultMatch) {

                    /**
                     *  Blank any old entries
                     */
                    if (solSearchResults[i].po_date || solSearchResults[i].po_name || solSearchResults[i].expected_date) {

                        log.audit('Not matched PO, Clearing old value', solSearchResults[i]);

                        salesOrder = record.load({
                            type: record.Type.SALES_ORDER,
                            id: solSearchResults[i].internalid,
                            isDynamic: false
                        });


                        var existingValue = salesOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: solSearchResults[i].line.toFixed()
                        });

                        if (!existingValue || existingValue != solSearchResults[i].item) {

                            log.error('Line match failed on remove', [solSearchResults[i].line.toFixed(), existingValue, solSearchResults[i]]);

                        } else {

                            log.debug('Existing PO on line', [solSearchResults[i].line.toFixed(), existingValue]);


                            salesOrder.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_prob_po_date',
                                line: solSearchResults[i].line.toFixed(),
                                value: null
                            });

                            salesOrder.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_expected_into_warehouse',
                                line: solSearchResults[i].line.toFixed(),
                                value: ''
                            });

                            salesOrder.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_prob_po_number',
                                line: solSearchResults[i].line.toFixed(),
                                value: null
                            });

                            try {
                                id = salesOrder.save();
                            } catch (err) {
                                log.error('save failed');
                                log.error('so', solSearchResults[i]);
                                log.error('po', polSearchResults[j]);
                                log.error('error', err);
                                log.error('failed so', salesOrder);
                            }
                        }
                    } else {
                        /** log.debug('Not matched PO, No action required', solSearchResults[i]); **/
                    }
                }
            }

            log.audit('Finished run');


            /**
             *  Function to get uniques
             *
             * @param array
             * @param property
             * @returns {Array}
             */
            function get_unique_values_from_array_object(array, property) {
                var unique = {};
                var distinct = [];
                for (var i in array) {
                    if (typeof (unique[array[i][property]]) == "undefined") {
                        distinct.push(array[i][property]);
                    }
                    unique[array[i][property]] = 0;
                }
                return distinct;
            }

            function addDays(date, days) {
                var result = new Date(date);
                result.setDate(result.getDate() + days);
                return result;
            }

        }

        return {
            execute: execute
        };


    }
);

/**
 * updated 11.47
 **/




