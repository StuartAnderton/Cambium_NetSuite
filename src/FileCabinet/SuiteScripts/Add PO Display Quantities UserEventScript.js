/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime'],
    /**

     */
    (record, search, runtime) => {


        const beforeSubmit = (scriptContext) => {
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

            log.debug('context', scriptContext)

            const newRecord = scriptContext.newRecord;
            const purchaseOrderId = newRecord.id;
var cumulativeValueChange = 0


            const scriptObj = runtime.getCurrentScript();
            const discountItem = scriptObj.getParameter({name: 'custscript_bundles_discount_id'});


            // find kit representing components

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

                // get components of kit

                const sourceKit = record.load({
                    type: record.Type.KIT_ITEM,
                    id: representsBundleInKit
                });

                const kitCostPrice = sourceKit.getValue(
                    {fieldId: 'custitem_cost_price_from_components'}
                )

                cumulativeValueChange = cumulativeValueChange + (kitCostPrice * kitQuantity);

                log.debug('Processing Kit', sourceKit)

                const componentsNumber = sourceKit.getLineCount({
                    sublistId: 'member'
                })



                for (let i = 0; i < componentsNumber; i++) {

                    const componentId = sourceKit.getSublistValue({
                        sublistId: 'member',
                        fieldId: 'item',
                        line: i
                    })

                    const componentQuantity = sourceKit.getSublistValue({
                        sublistId: 'member',
                        fieldId: 'quantity',
                        line: i
                    })

                    log.debug('Line ' + i, [componentId, componentQuantity])

                    if (componentId == theDummyItem) {
                        continue
                    }

                    //find the component in the PO

                    var purchaseOrder = record.load({
                        type: record.Type.PURCHASE_ORDER,
                        id: purchaseOrderId,
                        isDynamic: false
                    })

                    const lineToChange = purchaseOrder.findSublistLineWithValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: componentId
                    })

                    const initialQuantity = purchaseOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: lineToChange
                    })

                    const initialRate = purchaseOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        line: lineToChange
                    })

                    log.debug('Current Quantity ' + i, [componentId, initialQuantity])

                    const quantityFromKit = componentQuantity * kitQuantity;

                    const newQuantity = initialQuantity - quantityFromKit;

                    const valueChange = quantityFromKit * initialRate * -1

                    cumulativeValueChange = cumulativeValueChange + valueChange

                    if (newQuantity < 0) {
                        log.error('Negative quantity!', [componentId, initialQuantity, quantityFromKit])
                        continue
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

                // Adjust values

                // check if discount item already exists

                var purchaseOrder = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: purchaseOrderId,
                    isDynamic: false
                })

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

                log.debug('Setting discount', [discountLine, cumulativeValueChange])

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
                    value: cumulativeValueChange
                })

                purchaseOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: discountLine,
                    value: cumulativeValueChange
                })

                purchaseOrder.save()



                return true

            })
        }

        return {beforeSubmit, afterSubmit}

    }
)
;
