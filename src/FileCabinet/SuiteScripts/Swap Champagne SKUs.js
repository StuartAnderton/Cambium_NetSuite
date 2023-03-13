/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

/**
 *  Script to swap a dummy item on an SO for real one at x daty before delivery
 *  Used to allow lower stock to be maintained of upsell items, eg champagne
 */


define(['N/record', 'N/search', 'N/runtime'],
    /**
     * @param {record}
     *            record
     * @param {search}
     *            search
     */
    function (record, search, runtime) {

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

            var salesorderSearchResults = [];

            var itemId = runtime.getCurrentScript().getParameter('custscript_item_to_swap');
            var swapToId = runtime.getCurrentScript().getParameter('custscript_swap_to');
            var daysBeforeDelivery = runtime.getCurrentScript().getParameter('custscript_days_before');

            var salesorderSearchColInternalId = search.createColumn({name: 'internalid', sort: search.Sort.DESC});
            var salesorderSearchColLineId = search.createColumn({name: 'line'});
            var salesorderSearchColQuantity = search.createColumn({name: 'quantity'});
            var salesorderSearchColQuantityCommitted = search.createColumn({name: 'quantitycommitted'});
            var salesorderSearchColQuantityBilled = search.createColumn({name: 'quantitybilled'});
            var salesorderSearchColItem = search.createColumn({name: 'item'});
            var salesorderSearchColAmount = search.createColumn({name: 'amount'});
            var salesorderSearchColName = search.createColumn({name: 'entity'});
            var salesorderSearchColDeliveryDate = search.createColumn({
                name: 'custentity_bb1_del_date',
                join: 'customer'
            });
            var salesorderSearchColCutoffDate = search.createColumn({
                name: 'formuladate',
                formula: '{customer.custentity_bb1_del_date} - ' + daysBeforeDelivery
            });
            var salesorderSearchColOriginatingIdLpod = search.createColumn({name: 'custcol_originating_list_purchase_id'});


            var salesorderSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    'AND',
                    ['item', 'anyof', itemId],
                    'AND',
                    ['quantitycommitted', 'greaterthan', '0'],
                    'AND',
                    ['customer.custentity_bb1_del_date', 'isnotempty', ''],
                    'AND',
                    ['formuladate: {customer.custentity_bb1_del_date} - ' + daysBeforeDelivery, 'onorbefore', 'today'],
                ],
                columns: [
                    salesorderSearchColInternalId,
                    salesorderSearchColLineId,
                    salesorderSearchColQuantity,
                    salesorderSearchColQuantityCommitted,
                    salesorderSearchColQuantityBilled,
                    salesorderSearchColItem,
                    salesorderSearchColAmount,
                    salesorderSearchColName,
                    salesorderSearchColDeliveryDate,
                    salesorderSearchColCutoffDate,
                    salesorderSearchColOriginatingIdLpod
                ]
            })

            /**
             * Limit to 10 for testing - remove in production
             */
            var salesorderResultset = salesorderSearch.run().getRange({
                start: 0,
                end: 1000
            });

            // log.debug('Raw results', salesorderResultset)

            /**
             * Process results into an object
             */

            for (var i = 0; i < salesorderResultset.length; i++) {
                var tempObj = {};

                /**
                 * Create one line per column in results
                 */
                tempObj.so_internalid = salesorderResultset[i].getValue({
                    name: 'internalid'
                });
                tempObj.lineid = salesorderResultset[i].getValue({
                    name: 'line'
                });
                tempObj.quantity = salesorderResultset[i].getValue({
                    name: 'quantity'
                });
                tempObj.committed = salesorderResultset[i].getValue({
                    name: 'quantitycommitted'
                });
                tempObj.billed = salesorderResultset[i].getValue({
                    name: 'quantitybilled'
                });
                tempObj.item = salesorderResultset[i].getValue({
                    name: 'item'
                });
                tempObj.amount = salesorderResultset[i].getValue({
                    name: 'amount'
                });
                tempObj.customer = salesorderResultset[i].getValue({
                    name: 'entity'
                });
                tempObj.delivery_date = salesorderResultset[i].getValue({
                    name: 'custentity_bb1_del_date',
                    join: 'customer'
                });
                tempObj.cutoff_date = salesorderResultset[i].getValue({
                    name: 'formuladate'
                });
                tempObj.order_id = salesorderResultset[i].getValue({
                    name: 'custcol_originating_list_purchase_id'
                });


                salesorderSearchResults.push(tempObj);
            }

            // log.debug('results', salesorderSearchResults)

            /**
             * Iterate through records doing stuff
             */
            for (var j in salesorderSearchResults) {


                log.debug(j, salesorderSearchResults[j])

                /**
                 * Create new SO for replacement product
                 */

                var newSalesOrder = record.create({
                    type: record.Type.SALES_ORDER
                })

                newSalesOrder.setValue({
                    fieldId: 'location',
                    value: 1
                })

                newSalesOrder.setValue({
                    fieldId: 'currency',
                    value: 1
                })

                newSalesOrder.setValue({
                    fieldId: 'entity',
                    value: salesorderSearchResults[j].customer
                })

                newSalesOrder.setValue({
                    fieldId: 'memo',
                    value: 'SO created for conversion of virtual upsell item to real item'
                })

                newSalesOrder.insertLine({
                    sublistId: 'item',
                    line: 0,
                });

                newSalesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: 0,
                    value: swapToId
                });

                newSalesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: 0,
                    value: salesorderSearchResults[j].committed
                });

                newSalesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_originating_list_purchase_id',
                    line: 0,
                    value: salesorderSearchResults[j].order_id
                });

                if (salesorderSearchResults[j].billed === salesorderSearchResults[j].committed) {
                    newSalesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: 0,
                        value: 0
                    });
                } else {
                    newSalesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: 0,
                        value: salesorderSearchResults[j].amount
                    });

                }
                try {
                    var newSOId = newSalesOrder.save();
                    log.audit('New SO Created', newSOId)
                } catch (e) {
                    log.error('New SO create failed', [e, salesorderSearchResults[j]])
                    break
                }





                /**
                 * Remove/zero line from original SO
                 */

                var oldSo = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesorderSearchResults[j].so_internalid
                })

                var lineToZero = oldSo.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'custcol_originating_list_purchase_id',
                    value: salesorderSearchResults[j].order_id
                })

                if(!lineToZero) {
                    log.error('Matching Order ID not found, SO not updated', salesorderSearchResults[j])
                    break
                }

                oldSo.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: lineToZero,
                    value: 0
                });

                oldSo.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_originating_list_purchase_id',
                    line: lineToZero,
                    value: null
                });

                oldSo.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'description',
                    line: lineToZero,
                    value: 'Set to zero as moved to real item on new SO ' + newSOId + '. Was originally linked to ' + salesorderSearchResults[j].order_id
                });

                try {
                    oldSo.save();
                    log.debug('Old SO updated', salesorderSearchResults[j].so_internalid)
                } catch (e) {
                    log.error('Old SO update failed', [e, salesorderSearchResults[j]])
                    break
                }

            }

        }

        return {
            execute: execute
        };

    });
