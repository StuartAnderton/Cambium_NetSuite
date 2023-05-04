/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 *  Bills Outlet Orders on IF save
 *
 */
define(['N/record', 'N/search', 'N/runtime'],
    /**
     */
    (record, search, runtime) => {

        const afterSubmit = (scriptContext) => {

            const script = runtime.getCurrentScript();

            var shippingChargeId = script.getParameter({name: 'custscript_outlet_ship_charge'});

            const itemFulfillment = scriptContext.newRecord

            const itemFulfillmentName = itemFulfillment.getValue({
                fieldId: 'tranid'
            })

            const salesOrderId = itemFulfillment.getValue({
                fieldId: 'createdfrom'
            })

            const orderSource = search.lookupFields({
                type: search.Type.SALES_ORDER,
                id: salesOrderId,
                columns: ['custbody_owning_brand']
            });

            if(orderSource.custbody_owning_brand[0].text != 'Cambium : The Homeware Outlet') {
                log.debug('Wrong OB', orderSource.custbody_owning_brand[0].text)
                return}

            const newBill = record.transform({
                fromType: record.Type.SALES_ORDER,
                toType: record.Type.INVOICE,
                fromId: salesOrderId
            })

            const salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId
            })


            let lineCount = newBill.getLineCount({
                sublistId: 'item'
            })

            for (let i = lineCount - 1; i >= 0; i--) {


                const billItemId = newBill.getSublistValue({
                    sublistId: 'item',
                    line: i,
                    fieldId: 'item'
                })

                const fulfillmentLine = itemFulfillment.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: billItemId
                })

                log.debug ('Line ' + i, [billItemId, fulfillmentLine])

                if (fulfillmentLine === -1) {

                    // line not in fulfillment so remove if not shipping charge

                    if (billItemId !== shippingChargeId) {

                        newBill.removeLine({
                            sublistId: 'item',
                            line: i
                        })

                        log.debug('Line Removed' + i, [billItemId])
                    }


                } else {

                    const fulfillmentQuantity = itemFulfillment.getSublistValue({
                        sublistId: 'item',
                        line: fulfillmentLine,
                        fieldId: 'quantity'
                    })

                    const billAmount = newBill.getSublistValue({
                        sublistId: 'item',
                        line: i,
                        fieldId: 'amount'
                    })

                    const billQuantity = newBill.getSublistValue({
                        sublistId: 'item',
                        line: i,
                        fieldId: 'quantity'
                    })

                    const newAmount = billAmount * (fulfillmentQuantity/billQuantity)

                    if(fulfillmentQuantity > 0) {

                        newBill.setSublistValue({
                            sublistId: 'item',
                            line: i,
                            fieldId: 'quantity',
                            value: fulfillmentQuantity
                        })

                        newBill.setSublistValue({
                            sublistId: 'item',
                            line: i,
                            fieldId: 'amount',
                            value: newAmount
                        })

                        log.debug('Line updated ' + i, [billItemId, fulfillmentQuantity, newAmount])

                    } else {
                        newBill.removeLine({
                            sublistId: 'item',
                            line: i
                        })

                        log.debug('Line Removed' + i, [billItemId])

                    }

                }

            }

            const orderDate = salesOrder.getValue({
                fieldId: 'trandate'
            });

            log.debug('Change dates', [ orderDate])

            newBill.setValue({
                fieldId: 'trandate',
                value: orderDate
            })

            var billId = newBill.save()

            log.audit('Fulfillment billed', [billId,itemFulfillmentName])

        }

        return {afterSubmit}

    });
