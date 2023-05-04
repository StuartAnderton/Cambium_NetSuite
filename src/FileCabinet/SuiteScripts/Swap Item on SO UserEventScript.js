/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'],
    /**
 */
    (record, search) => {


        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

            var replaceWith = null;
            var originalItem = null;
            var lookupRecord = null;
            var amount = 0;
            var tax_code =  null;
            var order_id = 0;
            var amount_paid = 0;

            var salesOrder = scriptContext.newRecord;

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
                    columns: 'custitem_swap_to'
                });

                log.debug('lookupRecord row ' + i, lookupRecord)

                if (!lookupRecord.custitem_swap_to[0]) {
                    continue
                }

                replaceWith = lookupRecord.custitem_swap_to[0].value;

                log.debug('Replace with', replaceWith)

                // Store the amount etc. as it will be changed if the replacement has a different price

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

        return {beforeSubmit}

    });
