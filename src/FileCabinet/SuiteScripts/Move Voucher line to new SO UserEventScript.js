/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/search'],
    /**

 */
    (record, runtime, search) => {


        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {


            const voucherLocation = 5

            const thisOrder = scriptContext.newRecord;

            const thisLocation = thisOrder.getValue('location')

            log.debug('Location', thisLocation)

            if (thisLocation == voucherLocation) {return}

            const thisId = thisOrder.getValue('id')

            var salesorderSearchResults = [];

            const salesorderSearchColInternalId = search.createColumn({ name: 'internalid' });
            const salesorderSearchColLine = search.createColumn({ name: 'lineuniquekey' });
            const salesorderSearchColQuantity = search.createColumn({ name: 'quantity' });
            const salesorderSearchColOriginatingIdLpod = search.createColumn({ name: 'custcol_originating_list_purchase_id' });
            const salesorderSearchColItem = search.createColumn({ name: 'item' });
            const salesorderSearchColAmount = search.createColumn({ name: 'amount' });
            const salesorderSearchColName = search.createColumn({ name: 'entity' });
            const salesorderSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    'AND',
                    ['item.custitem_is_voucher', 'is', 'T'],
                    'AND',
                    ['custbody_owning_brand', 'anyof', '9'],
                    'AND',
                    ['quantity', 'greaterthan', '0'],
                    'AND',
                    ['internalid', 'anyof', thisId],
                ],
                columns: [
                    salesorderSearchColInternalId,
                    salesorderSearchColLine,
                    salesorderSearchColQuantity,
                    salesorderSearchColOriginatingIdLpod,
                    salesorderSearchColItem,
                    salesorderSearchColAmount,
                    salesorderSearchColName
                ],
            });


            var salesorderResultset = salesorderSearch.run().getRange({
                start: 0,
                end: 1000
            });

             log.debug('Raw results', salesorderResultset)

            if (salesorderResultset.length === 0) {
                log.debug('No results')
                return
            }

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
                    name: 'lineuniquekey'
                });
                tempObj.quantity = salesorderResultset[i].getValue({
                    name: 'quantity'
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
                tempObj.order_id = salesorderResultset[i].getValue({
                    name: 'custcol_originating_list_purchase_id'
                });


                salesorderSearchResults.push(tempObj);
            }

             log.debug('results', salesorderSearchResults)



            /**
             * Create new SO for voucher
             */


            var newSalesOrder = record.create({
                type: record.Type.SALES_ORDER
            })

            newSalesOrder.setValue({
                fieldId: 'location',
                value: voucherLocation
            })

            newSalesOrder.setValue({
                fieldId: 'currency',
                value: 1
            })

            newSalesOrder.setValue({
                fieldId: 'entity',
                value: salesorderSearchResults[0].customer
            })

            newSalesOrder.setValue({
                fieldId: 'memo',
                value: 'SO created for voucher in Prezola SO'
            })

            for (var j in salesorderSearchResults) {


                log.debug(j, salesorderSearchResults[j])

                newSalesOrder.insertLine({
                    sublistId: 'item',
                    line: 0,
                });

                newSalesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: 0,
                    value: salesorderSearchResults[j].item
                });

                newSalesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: 0,
                    value: salesorderSearchResults[j].quantity
                });

                newSalesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_originating_list_purchase_id',
                    line: 0,
                    value: salesorderSearchResults[j].order_id
                });

                    newSalesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: 0,
                        value: salesorderSearchResults[j].amount
                    });


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

                log.debug('lineToZero', lineToZero)

                if(lineToZero === -1) {
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
                    value: 'Set to zero as moved to new SO ' + newSOId + '. Was originally linked to ' + salesorderSearchResults[j].order_id
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

        return {afterSubmit}

    });
