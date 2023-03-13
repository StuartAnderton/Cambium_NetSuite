/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */


/**
 *  Workflow action to deal with a UTF product
 */


define(['N/https', 'N/runtime', 'N/record', 'N/search'],
    function (https, runtime, record, search) {
        function onAction(scriptContext) {
            log.debug({
                title: 'Start Script'
            });
            var poId;
            var soId;
            var lineQuantity;
            var line;
            var messageLine;
            var purchaseOrder;
            var poItem;
            var poQuantity;
            var check;
            var salesOrder;
            var soItem;
            var soQuantity;
            var soQuantityCommitted;
            var soQuantityPicked;
            var soQuantityBilled;
            var soQuantityOutstanding;
            var soQuantityToSet;
            var poQuantityReceived;
            var defaultFilters;
            var soGrossAmount;
            var soAmountToCredit;
            var cmsResponse;
            var wishlistId;
            var customerId;
            var creditRecord;
            var customerExternalId;
            var customer;



            var newRecord = scriptContext.newRecord;
            var utfItemName = newRecord.getValue({
                fieldId: 'itemid'
            });
            var utfItemId = newRecord.getValue({
                fieldId: 'internalid'
            });
            var message = 'Marking ' + utfItemName + ' as Unable To Fulfill';

            log.debug('Message', message);


            // Get Open POs containing item


            var polSearch = search.load({
                id: 'customsearch_open_purchase_orders'
            });
            defaultFilters = polSearch.filters;
            defaultFilters.push(search.createFilter({
                name: 'item',
                operator: search.Operator.ANYOF,
                values: utfItemId
            }));
            polSearch.filters = defaultFilters;

            message = message + '\n' +
                'Found POs:\n';


            polSearch.run().each(function (result) {

                poId = result.getValue({
                    name: 'internalid'
                });
                line = result.getValue({
                    name: 'line'
                });

                //Because Netsuite can't decide if it's indexing sublists from 0 or 1
                line = line - 1;

                lineQuantity = result.getValue({
                    name: 'formulanumeric'
                }).valueOf();

                //messageLine = 'PO ID: ' + poId + ' Line: ' + line + ' Quantity: ' + lineQuantity;
                // message = message + messageLine + '\n';

                log.debug('POs', messageLine);

                purchaseOrder = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: poId
                });

                poItem = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: line
                });

                poQuantityReceived = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantityshiprecv',
                    line: line
                }) || 0;

                log.debug('PO values', [poQuantityReceived]);


                if (utfItemId == poItem) {

                    log.debug('PO Line Matched on line ', line);

                    // Zero lines for the item

                    purchaseOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: line,
                        value: poQuantityReceived
                    });

                    try {
                        check = purchaseOrder.save();
                        log.debug('Saved', [check, poQuantityReceived]);
                        message = message + 'Changed PO ID ' + poId + ' line ' + line + ' to quantity ' + poQuantityReceived + '\n';
                    } catch (err) {
                        log.error('Save Failed', err);
                    }

                } else {
                    log.error('No matching PO');
                }

                return true;
            });

            // Get open SOs containing item

            var solSearch = search.load({
                id: 'customsearch_open_sales_orders'
            });
            defaultFilters = solSearch.filters;
            defaultFilters.push(search.createFilter({
                name: 'item',
                operator: search.Operator.ANYOF,
                values: utfItemId
            }));
            solSearch.filters = defaultFilters;

            message = message +
                'Found SOs:\n';

            solSearch.run().each(function (result) {

                soId = result.getValue({
                    name: 'internalid'
                });
                line = result.getValue({
                    name: 'linesequencenumber'
                });
                //Because Netsuite can't decide if it's indexing sublists from 0 or 1
                line = line - 1;
                lineQuantity = result.getValue({
                    name: 'formulanumeric'
                }).valueOf();

                //messageLine = 'SO ID: ' + soId + ' Line: ' + line + ' Quantity: ' + lineQuantity;
                //message = message + messageLine + '\n';

                log.debug('SOs', messageLine);

                salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: soId
                });

                soItem = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: line
                });

                soQuantity = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: line
                });

                soQuantityCommitted = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantitycommitted',
                    line: line
                }) || 0;

                soQuantityPicked = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantitypicked',
                    line: line
                }) || 0;

                soQuantityBilled = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantitybilled',
                    line: line
                }) || 0;

                soGrossAmount = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'grossamt',
                    line: line
                });

                customerId = salesOrder.getValue({
                    fieldId: 'entity'
                });

                customer = record.load({
                    type: record.Type.CUSTOMER,
                    id: customerId
                });

                customerExternalId = customer.getValue({
                    fieldId: 'externalid'
                });

                wishlistId = customerExternalId.substr(1, 8);

                soQuantityOutstanding = soQuantity - soQuantityCommitted - soQuantityPicked;

                soQuantityToSet = soQuantity - soQuantityOutstanding;

                log.debug('SO values', [soQuantity, soQuantityCommitted, soQuantityPicked, soQuantityOutstanding, soQuantityToSet, soQuantityBilled]);

                if (utfItemId == soItem) {

                    log.debug('SO Line Matched on line ', line);

                    // Zero lines for the item

                    salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: line,
                        value: soQuantityToSet
                    });

                    try {
                        check = salesOrder.save();
                        log.debug('Saved', check);
                        message = message + 'Changed SO ID ' + soId + ' line ' + line + ' to quantity ' + soQuantityToSet + '\n';
                    } catch (err) {
                        log.error('Save Failed', err);
                    }

                    soAmountToCredit = (soGrossAmount / soQuantity) * soQuantityOutstanding;


                    //Create CMS credit

                    cmsResponse = creditCms(wishlistId, soAmountToCredit);

                    message = message + cmsResponse + '\n';

                    if (soQuantity == soQuantityBilled) {

                        log.debug('SO fully billed');

                        //If billed, create NS Credit

                        creditRecord = creditNetsuite(customerId, soAmountToCredit, utfItemId, soQuantityOutstanding);
                        message = message + 'Created NS credit ID ' + creditRecord + '\n';


                    } else if (soQuantityBilled > 0) {
                        log.debug('Partially billed');
                    } else {
                        log.debug('Not Billed');
                    }


                } else {
                    log.error('No matching SO');
                }






                return true;
            });


            function creditCms(wishlistId, amount) {

                var cmsResponse = 'Credited WL '+ wishlistId + ' with £' + amount;

                return cmsResponse

            }

            function creditNetsuite(customer, amount, item, quantity) {

                var credit = record.create({
                    type: record.Type.CREDIT_MEMO,
                    defaultValues: {
                        entity: customer
                    }
                });

                credit.setValue({
                    fieldId: 'location',
                    value: '1'
                });

                credit.setValue({
                    fieldId: 'memo',
                    value: 'Created by UTF script'
                });


                credit.insertLine({
                    sublistId: 'item',
                    line: 0,
                });

                credit.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: 0,
                    value: quantity
                });

                credit.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: 0,
                    value: item
                });

                credit.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'grossamt',
                    line: 0,
                    value: amount
                });

                creditRecord = credit.save();

                return creditRecord

            }


            return message
        }

        return {
            onAction: onAction
        }
    });