/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * Suitelet to process Shopify orders
 *
 */
define(['N/record', 'N/runtime', 'N/search', 'N/format'],
    /**

     */
    (record, runtime, search, format) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            if (scriptContext.request.method === 'POST') {

                log.debug('running', scriptContext.request.body)

                var tho_company;
                var fulfillment_co;
                var currency;
                var locationId;
                var shipping_nii;

                const isProduction = runtime.envType === runtime.EnvType.PRODUCTION;

                // authorization check
                var scriptObj = runtime.getCurrentScript();
                var code = scriptObj.getParameter({name: 'custscript_tho_orders_code'});
                var headers = scriptContext.request.headers
                log.debug('Headers', [code, headers.code])
                if (code !== headers.code) {
                    scriptContext.response.write('Security check failed');
                    log.error('Access Denied', scriptContext.request)
                    return
                }

                scriptContext.response.write('Received ' + scriptContext.request.body);

                if (isProduction) {
                    // set Production variables
                    tho_company = 13;
                    fulfillment_co = 1;
                    currency = 1;
                    locationId = 1;
                } else {
                    // set Sandbox variables
                    tho_company = 13;
                    fulfillment_co = 1;
                    currency = 1;
                    locationId = 1;
                    shipping_nii = 1198861
                }

                var order = JSON.parse(scriptContext.request.body);

                log.debug('order', order)

                var customerId = customerExists(order.customer);

                customerId = createOrUpdateCustomer(order, tho_company, fulfillment_co, currency, customerId);

                // See if SO exists

                const salesorderSearchColInternalId = search.createColumn({name: 'internalid'});
                const salesorderSearch = search.create({
                    type: 'salesorder',
                    filters: [
                        ['type', 'anyof', 'SalesOrd'],
                        'AND',
                        ['externalid', 'anyof', order.salesorder],
                        'AND',
                        ['mainline', 'is', 'T'],
                    ],
                    columns: [
                        salesorderSearchColInternalId,
                    ],
                });

                var resultSet = salesorderSearch.run();

                var result = resultSet.getRange({
                    start: 0,
                    end: 1
                });

                if (result.length !== 0) {

                    var salesorderId = result[0].getValue({
                        name: 'internalid'
                    });

                    if (order.type === 'cancel') {
                        cancelSalesOrder(salesorderId, order.orderid);
                        return
                    }

                }

                if (result.length === 0) {
                    //transaction record create, add  shipping

                    var salesOrder = record.create({
                        type: record.Type.SALES_ORDER,
                        isDynamic: false
                    })

                    salesOrder.setValue({
                        fieldId: 'externalid',
                        value: order.salesorder
                    })

                    salesOrder.setValue({
                        fieldId: 'tranid',
                        value: order.salesorder
                    })

                    salesOrder.setValue({
                        fieldId: 'entity',
                        value: customerId
                    })

                    salesOrder.setValue({
                        fieldId: 'location',
                        value: locationId
                    })

                    salesOrder.setValue({
                        fieldId: 'custbody_shopify_order',
                        value: order.orderid
                    })

                    salesOrder.setValue({
                        fieldId: 'custbodysales_channel',
                        value: 'Cambium : The Homeware Outlet'
                    })

                    salesOrder.setValue({
                        fieldId: 'location',
                        value: locationId
                    })

                    if (order.shipping > 0) {

                        salesOrder.insertLine({
                            sublistId: 'item',
                            line: 0
                        })


                        salesOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: 0,
                            value: shipping_nii
                        })

                        salesOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_gross_amount_entry',
                            line: 0,
                            value: order.shipping
                        })

                        salesOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            line: 0,
                            value: order.shipping
                        })

                        salesOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: 0,
                            value: 1
                        })

                        salesOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_originating_list_purchase_id',
                            line: 0,
                            value: order.orderid
                        })
                    }
                } else {

                    log.audit('SO already exists', salesorderId)

                    return
                    //transaction record load

/*                     salesOrder = record.load({
                        type: record.Type.SALES_ORDER,
                        id: salesorderId
                    }) */
                }

                // add lines

                var ids = order.orderlineid.split(',')
                var items = order.item.split(',')
                var quantities = order.quantity.split(',')
                var amounts = order.amount.split(',')

                for (let i = 0; i < ids.length; i++) {

                    salesOrder.insertLine({
                        sublistId: 'item',
                        line: 0
                    })

                    salesOrder.setSublistText({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: 0,
                        text: items[i]
                    })

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_gross_amount_entry',
                        line: 0,
                        value: amounts[i] * quantities[i]
                    })

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: 0,
                        value: amounts[i] * quantities[i]
                    })

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: 0,
                        value: quantities[i]
                    })

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_originating_list_purchase_id',
                        line: 0,
                        value: ids[i]
                    })

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_bb1_hold',
                        line: 0,
                        value: false
                    })


                }

                log.debug('Before Save', salesOrder)

                var salesOrderSaved = salesOrder.save()

                log.audit('SO created for ' + order.salesorder, salesOrderSaved)

                var bill = record.transform({
                    fromType: record.Type.SALES_ORDER,
                    fromId: salesOrderSaved,
                    toType: record.Type.INVOICE
                })

                var billId = bill.save()

                log.audit(order.salesorder + ' Billed', billId)

            }

        }

        return {onRequest}

        function customerExists(idToCheck) {

            // check if customer exists

            const customerSearchColInternalId = search.createColumn({name: 'internalid'});
            const customerSearch = search.create({
                type: 'customer',
                filters: [
                    ['externalid', 'is', idToCheck],
                ],
                columns: [
                    customerSearchColInternalId,
                ],
            });

            var customerResultSet = customerSearch.run();

            log.debug('customerResultSet', customerResultSet)

            var customerResult = customerResultSet.getRange({
                start: 0,
                end: 1
            });

            log.debug('customerResult', customerResult)

            if (customerResult.length !== 0) {

                var customerId = customerResult[0].getValue({
                    name: 'internalid'
                });
            } else {

                customerId = -1
            }

            return customerId
        }

        function cancelSalesOrder(id, originatingSO) {

            const salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: id
            })

            const lineCount = salesOrder.getLineCount({
                sublistId: 'item'
            })

            for (let i = 0; i < lineCount; i++) {

                salesOrder.setSublistValue({
                    sublistId: 'item',
                    line: i,
                    fieldId: 'quantity',
                    value: 0
                })
            }

            salesOrder.save()

            log.audit('SO cancelled', id)

            const invoiceSearchColInternalId = search.createColumn({name: 'internalid'});
            const invoiceSearch = search.create({
                type: 'invoice',
                filters: [
                    ['custbody_shopify_order', 'is', originatingSO],
                    'AND',
                    ['mainline', 'is', 'T'],
                ],
                columns: [
                    invoiceSearchColInternalId,
                ],
            });

            var resultSet = invoiceSearch.run();

            var result = resultSet.getRange({
                start: 0,
                end: 1
            });

            log.debug('Found bill', result)

            var invoiceId = result[0].getValue({
                name: 'internalid'
            });

            var creditMemo = record.transform({
                fromType: record.Type.INVOICE,
                fromId: invoiceId,
                toType: record.Type.CREDIT_MEMO
            })

            var creditMemoId = creditMemo.save()

            log.audit('Bill ' + invoiceId + ' Credited', creditMemoId)


        }

        function createOrUpdateCustomer(order, company, fulfillment_co, currency, customer_id) {

            if (customer_id === -1) {
                var create = true
            }


            if (create) {
                var customerRecord = record.create({
                    type: record.Type.CUSTOMER,
                    isDynamic: false
                })
            } else {
                customerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: customer_id,
                    isDynamic: false
                })
            }

            if (create) {
                customerRecord.setValue({
                    fieldId: 'entityid',
                    value: order.customer
                })

                customerRecord.setValue({
                    fieldId: 'externalid',
                    value: order.customer
                })


                customerRecord.setValue({
                    fieldId: 'firstname',
                    value: order.firstname
                })

                customerRecord.setValue({
                    fieldId: 'lastname',
                    value: order.lastname
                })

                customerRecord.setValue({
                    fieldId: 'custentity_bb1_list_title',
                    value: order.listtitle
                })

                customerRecord.setValue({
                    fieldId: 'custentity_owning_brand',
                    value: company
                })

                customerRecord.setValue({
                    fieldId: 'subsidiary',
                    value: fulfillment_co
                })

                customerRecord.setValue({
                    fieldId: 'currency',
                    value: currency
                })
            }

            customerRecord.setValue({
                fieldId: 'custentity_bb1_del_date',
                value: new Date()
            })

            customerRecord.setValue({
                fieldId: 'email',
                value: order.email
            })

            customerRecord.setValue({
                fieldId: 'phone',
                value: order.phone
            })

            if (create) {
                customerRecord.insertLine({
                    sublistId: 'addressbook',
                    line: 0
                });
            }

            customerRecord.setSublistValue({
                sublistId: 'addressbook',
                line: 0,
                fieldId: 'label',
                value: 'Primary Address'

            })

            var addressSubrecord = customerRecord.getSublistSubrecord({
                sublistId: 'addressbook',
                fieldId: 'addressbookaddress',
                line: 0
            })

            addressSubrecord.setValue({
                fieldId: 'country',
                value: order.country
            });

            addressSubrecord.setValue({
                fieldId: 'city',
                value: order.city
            });

            addressSubrecord.setValue({
                fieldId: 'zip',
                value: order.zip
            });

            addressSubrecord.setValue({
                fieldId: 'addr1',
                value: order.address1
            });

            addressSubrecord.setValue({
                fieldId: 'addr2',
                value: order.address2
            });

            var newCustomerId = customerRecord.save()

            if (create) {

                var customerSubsidiary = record.create({
                    type: record.Type.CUSTOMER_SUBSIDIARY_RELATIONSHIP
                })

                customerSubsidiary.setValue({
                    fieldId: 'entity',
                    value: newCustomerId
                })

                customerSubsidiary.setValue({
                    fieldId: 'subsidiary',
                    value: company
                })

                var customerSubId = customerSubsidiary.save()
            }

            return newCustomerId
        }


    });
