/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

define(['N/record'],

    function (record) {

        function beforeSubmit(context) {

            var salesOrder = context.newRecord;

            log.debug('Sales order', salesOrder)

            var numLines = salesOrder.getLineCount({
                sublistId: 'item'
            });

            //loop through the number of lines in SO

            for (var i = 0; i < numLines; i++) {

                var itemItemType = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'itemtype',
                        line: i
                    })
                ;

                if (itemItemType === 'InvtPart') {

                    var itemInternalId = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });

                    var item = record.load({
                        type: record.Type.INVENTORY_ITEM,
                        id: itemInternalId,
                    });

                    var isSpecialOrderItem = item.getValue({
                        fieldId: 'isspecialorderitem'
                    })

                    var masterItemId = item.getValue({fieldId: 'itemid'});

                    log.debug('Checking line ' + i, [masterItemId, isSpecialOrderItem])

                    if (isSpecialOrderItem == true && masterItemId.length === 10) {

                        var masterDisplayName = item.getValue({fieldId: 'displayname'});

                        var customerId = salesOrder.getValue({fieldId: 'entity'});

                        var customer = record.load({
                            type: record.Type.CUSTOMER,
                            id: customerId
                        });

                        var listId = customer.getValue({fieldId: 'entityid'});

                        var identifier = salesOrder.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_originating_list_purchase_id',
                                line: i
                            }
                        ) || listId;

                        // create new item, reassign this line to the new item

                        var customisedItem = record.copy({
                            type: record.Type.INVENTORY_ITEM,
                            id: itemInternalId
                        });

                        customisedItem.setValue({
                            fieldId: 'displayname',
                            value: '(' + listId + ') ' + masterDisplayName
                        });

                        customisedItem.setValue({
                            fieldId: 'externalid',
                            value: masterItemId + '_' + identifier
                        });

                        customisedItem.setValue({
                            fieldId: 'itemid',
                            value: masterItemId + '_' + identifier
                        });

                        customisedItem.setValue({
                            fieldId: 'upccode',
                            value: null
                        });

                        customisedItem.setValue({
                            fieldId: 'custitem_do_not_sync',
                            value: true
                        });

                        customisedItem.setValue({
                            fieldId: 'custitem_reporting_sku',
                            value: itemInternalId
                        });

                        log.audit('New Product created', masterItemId + '_' + identifier)

                        var newItemId = customisedItem.save();

                        salesOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i,
                            value: newItemId
                        })

                        log.debug('Line updated: ' + i, newItemId)

                    }

                }

                log.audit(('Sales Order updated'))

            }
        }

        return {
            beforeSubmit: beforeSubmit
        };

    });
