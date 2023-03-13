/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

/*
Script swaps SO lines for Items with custitemnon_duplicate_group_id set to the Item referenced in that variable.
Runs on BeforeSubmit event.
 */

define(['N/record', 'N/search'],

    function (record, search) {

        function beforeSubmit(context) {

            var replaceWith = null;
            var originalItem = null;
            var lookupRecord = null;
            var amount = 0;
            var tax_code =  null;
            var order_id = 0;
            var amount_paid = 0;

            var salesOrder = context.newRecord;

            log.debug('Processing sales order', salesOrder.getValue('tranid'))

            var numLines = salesOrder.getLineCount({
                sublistId: 'item'
            });

            //loop through the number of lines in SO

            for (var i = 0; i < numLines; i++) {

                lookupRecord = null;
                replaceWith = null;

                originalItem = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    }
                );

                // Get the custitemnon_duplicate_group_id

                lookupRecord = search.lookupFields({
                    type: search.Type.ITEM,
                    id: originalItem,
                    columns: 'custitemnon_duplicate_group_id'
                });

                log.debug('lookupRecord row ' + i, lookupRecord)

                if (!lookupRecord.custitemnon_duplicate_group_id[0]) {
                    continue
                }

                replaceWith = lookupRecord.custitemnon_duplicate_group_id[0].value;

                log.debug('Replace with', replaceWith)

                // Store the amount etc as it will be changed if the replacement has a different price

                amount = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i
                });

                tax_code = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'taxcode',
                    line: i
                });

                order_id = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_originating_list_purchase_id',
                    line: i
                });

                amount_paid = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_gross_amount_entry',
                    line: i
                });


                // Store the original Item in new field for CC to see

                salesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_original_item',
                    line: i,
                    value: originalItem
                })

                salesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i,
                    value: replaceWith
                })

                salesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i,
                    value: amount
                })

                salesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'taxcode',
                    line: i,
                    value: tax_code
                })

                salesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_originating_list_purchase_id',
                    line: i,
                    value: order_id
                })

                salesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_gross_amount_entry',
                    line: i,
                    value: amount_paid
                })

                log.audit('Replaced', originalItem + ' with ' + replaceWith + ' on ' + salesOrder.getValue('tranid'))

            }

        }

        return {
            beforeSubmit: beforeSubmit
        };

    });
