/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 *  Script to handle Kits which represent bundles bought from suppliers at a discount
 *
 *  Works by having a dummy item in the kit representing the supplier bundle.
 *
 *  We then create the PDF version of the PO to include that bundle, and have the component quantities adjusted accordingly.
 *
 *  Discounts are created so that the total on the PO accounts for the discount given and the dummy item.
 *
 *  On Approval, the dummy item is receipted, so it does not appear on the PO as it goes to Waerlinx
 *
 *  To allow for edits, a Before Submit resets all the display quantities and the After Submit then sets them to their correct values.
 *
 */
define(['N/record', 'N/search', 'N/runtime'],
    /**

     */
    (record, search, runtime) => {

        const beforeSubmit = (scriptContext) => {

            // Set Display Quantities in case of edits

            const newRecord = scriptContext.newRecord;
            const linesNumber = newRecord.getLineCount({
                sublistId: 'item'
            })

            for (let i = 0; i < linesNumber; i++) {

                const actualQuantity = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i

                })

                newRecord.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_display_quantity',
                    line: i,
                    value: actualQuantity

                })

                const actualRate = newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: i

                })

                newRecord.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_display_amount',
                    line: i,
                    value: actualRate * actualQuantity

                })
            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

            // Sets display quantities, adds discount, receives dummy items

            log.debug('context', scriptContext)

            const newRecord = scriptContext.newRecord;
            const purchaseOrderId = newRecord.id;
            var cumulativeValueChangeStandardRate = 0;
            var cumulativeValueChangeReducedRate = 0;
            var cumulativeValueChangeZeroRate = 0;

            const scriptObj = runtime.getCurrentScript();
            const discountItemStandardRate = scriptObj.getParameter({name: 'custscript_bundles_discount_id'});
            const discountItemReducedRate = scriptObj.getParameter({name: 'custscript_bundles_discount_id_reduced'});
            const discountItemZeroRate = scriptObj.getParameter({name: 'custscript_bundles_discount_id_zero'});

            // do Search to find any kit-representing components in PO

            const purchaseorderSearchColItem = search.createColumn({name: 'item'});
            const purchaseorderSearchColDisplayName = search.createColumn({name: 'displayname', join: 'item'});
            const purchaseorderSearchColQuantity = search.createColumn({name: 'quantity'});
            const purchaseorderSearchColRepresentsBundleInKit = search.createColumn({
                name: 'custitem_bundle_rep',
                join: 'item'
            });
            const purchaseorderSearch = search.create({
                type: 'purchaseorder',
                filters: [
                    ['internalid', 'anyof', purchaseOrderId],
                    'AND',
                    ['type', 'anyof', 'PurchOrd'],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    'AND',
                    ['item.custitem_bundle_rep', 'noneof', '@NONE@'],
                ],
                columns: [
                    purchaseorderSearchColItem,
                    purchaseorderSearchColDisplayName,
                    purchaseorderSearchColQuantity,
                    purchaseorderSearchColRepresentsBundleInKit,
                ],
            });

            purchaseorderSearch.run().each(function (result) {

                const kitQuantity = result.getValue(purchaseorderSearchColQuantity);
                const representsBundleInKit
                    = result.getValue(purchaseorderSearchColRepresentsBundleInKit);
                const theDummyItem = result.getValue(purchaseorderSearchColItem);

                log.debug('Found Kit representatives', [representsBundleInKit, kitQuantity])

                // get list of components of kit whose dummy has been found, iterate through them looking for them in the PO

                const sourceKit = record.load({
                    type: record.Type.KIT_ITEM,
                    id: representsBundleInKit
                });

                log.debug('Processing Kit', sourceKit)

                const componentsNumber = sourceKit.getLineCount({
                    sublistId: 'member'
                })

                for (let i = 0; i < componentsNumber; i++) {

                    var componentId = sourceKit.getSublistValue({
                        sublistId: 'member',
                        fieldId: 'item',
                        line: i
                    })

                    var componentQuantity = sourceKit.getSublistValue({
                        sublistId: 'member',
                        fieldId: 'quantity',
                        line: i
                    })

                    log.debug('Line ' + i, [componentId, componentQuantity, theDummyItem])

                    // find each component in the PO

                    var purchaseOrder = record.load({
                        type: record.Type.PURCHASE_ORDER,
                        id: purchaseOrderId,
                        isDynamic: false
                    })

                    var lineToChange = purchaseOrder.findSublistLineWithValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: componentId
                    })

                    // check if the component exists on the PO
                    if (lineToChange === -1) {
                        log.debug('Kit Component not in PO', [purchaseOrderId, componentId])
                        continue
                    }


                    if (componentId == theDummyItem) {

                        // If the item is the dummy item, receive it

                        if (purchaseOrder.getValue('approvalstatus') == 2) {

                            var initialQuantity = purchaseOrder.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line: lineToChange
                            })

                            var receivedQuantity = purchaseOrder.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantityreceived',
                                line: lineToChange
                            })

                            const quantityToReceive = initialQuantity - receivedQuantity

                            log.debug('To recieve', [quantityToReceive, initialQuantity, receivedQuantity])

                            if (quantityToReceive > 0) {

                                const itemReceipt = receiveItem(componentId, purchaseOrderId)

                                log.debug('Received dummy item', itemReceipt)

                                // reload PO as the act of receipting it changes it.

                                purchaseOrder = record.load({
                                    type: record.Type.PURCHASE_ORDER,
                                    id: purchaseOrderId,
                                    isDynamic: false
                                })


                            }
                        }

                    } else {

                        // Not the dummy item, so adjust display quantities

                        initialQuantity = purchaseOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: lineToChange
                        })

                        const initialRate = purchaseOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: lineToChange
                        })

                        const lineItem = purchaseOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: lineToChange
                        })

                        const taxCodeDisplay = purchaseOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode_display',
                            line: lineToChange
                        })

                        log.debug('Current Quantity ' + lineToChange, [componentId, lineItem, initialQuantity])

                        const quantityFromKit = componentQuantity * kitQuantity;

                        var newQuantity = initialQuantity - quantityFromKit;

                        if (newQuantity < 0) {

                            // allow for the quantity on the PO being less than the quantity suggested by the dummy, eg stock

                            log.audit('Negative quantity!', [componentId, initialQuantity, quantityFromKit]);

                            newQuantity = 0

                            var valueChange = initialQuantity * initialRate;

                        } else {

                            valueChange = quantityFromKit * initialRate;

                        }

                        // Track the cumulative value changes we are creating

                        if (taxCodeDisplay === 'VAT:S-GB') {

                            cumulativeValueChangeStandardRate = cumulativeValueChangeStandardRate + valueChange;

                            log.debug('Added to SR', valueChange)

                        } else if ((taxCodeDisplay === 'VAT:R-GB')) {

                            cumulativeValueChangeReducedRate = cumulativeValueChangeReducedRate + valueChange;

                            log.debug('Added to RR', valueChange)

                        } else {

                            cumulativeValueChangeZeroRate = cumulativeValueChangeZeroRate + valueChange

                            log.debug('Added to ZR', valueChange)
                        }

                        purchaseOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_display_quantity',
                            line: lineToChange,
                            value: newQuantity

                        })

                        purchaseOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_display_amount',
                            line: lineToChange,
                            value: newQuantity * initialRate

                        })

                        log.audit('Set Display Quantity', [componentId, newQuantity])

                        purchaseOrder.save()

                    }

                }

                // Adjust values with discount

                if (cumulativeValueChangeStandardRate > 0) {

                    const discountLine = createDiscount(purchaseOrder, discountItemStandardRate, cumulativeValueChangeStandardRate);

                    log.debug('Discount created', [discountItemStandardRate, cumulativeValueChangeStandardRate, discountLine])

                }

                if (cumulativeValueChangeReducedRate > 0) {

                    const discountLine = createDiscount(purchaseOrder, discountItemReducedRate, cumulativeValueChangeReducedRate);

                    log.debug('Discount created', [discountItemReducedRate, cumulativeValueChangeReducedRate, discountLine])

                }

                if (cumulativeValueChangeZeroRate > 0) {

                    const discountLine = createDiscount(purchaseOrder, discountItemZeroRate, cumulativeValueChangeZeroRate);

                    log.debug('Discount created', [discountItemZeroRate, cumulativeValueChangeZeroRate, discountLine])

                }

                purchaseOrder.save()

                return true

            })
        }

        function receiveItem(componentId, purchaseOrderId) {

            log.debug('Running receive function', [componentId, purchaseOrderId])

            const itemReceipt = record.transform({
                fromType: record.Type.PURCHASE_ORDER,
                fromId: purchaseOrderId,
                toType: record.Type.ITEM_RECEIPT
            })

            itemReceipt.setValue({
                fieldId: 'memo',
                value: 'Automatic receipt of dummy bundle item'
            })

            log.debug('ItemReceipt', itemReceipt)

            const lineNumber = itemReceipt.getLineCount({
                sublistId: 'item'
            })

            log.debug('Line count', lineNumber)

            for (let i = lineNumber - 1; i >= 0; i--) {

                let lineItem = itemReceipt.getSublistValue({
                    sublistId: 'item',
                    line: i,
                    fieldId: 'item'
                })

                log.debug('Checking line', [i, lineItem])

                if (lineItem != componentId) {

                    itemReceipt.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemreceive',
                        line: i,
                        value: false
                    })

                }
            }

            const itemReceiptId = itemReceipt.save()

            return itemReceiptId

        }

        function createDiscount(purchaseOrder, discountItem, discountAmount) {

            log.debug('Running discount add function', [purchaseOrder, discountItem, discountAmount])

            var discountLine = purchaseOrder.findSublistLineWithValue({
                sublistId: 'item',
                fieldId: 'item',
                value: discountItem
            })

            if (discountLine === -1) {

                discountLine = purchaseOrder.getLineCount({
                    sublistId: 'item'
                });

                purchaseOrder.insertLine({
                    sublistId: 'item',
                    line: discountLine
                })

                purchaseOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: discountLine,
                    value: discountItem
                })

            }

            log.debug('Setting discount', [discountLine, discountAmount])

            purchaseOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: discountLine,
                value: 1
            })

            purchaseOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                line: discountLine,
                value: discountAmount * -1
            })

            purchaseOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                line: discountLine,
                value: discountAmount * -1
            })

            return discountLine
        }

        return {beforeSubmit, afterSubmit}

    }
)
;
