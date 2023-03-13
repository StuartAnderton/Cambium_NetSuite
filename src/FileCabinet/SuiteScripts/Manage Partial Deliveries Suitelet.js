/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */


/**
 *
 * Suitelet to manage the contents of a partial delivery order
 *
 */

define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/format', 'N/http'],
    /**
 * @param{record} record
 * @param{search} search
 * @param{serverWidget} serverWidget
 */
    (record, search, ui, format, http) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (context) => {

            if (context.request.method === 'GET') {
                var form = ui.createForm({ title: 'Manage Partial Deliveries' });

                form.clientScriptModulePath = './Manage Partial Deliveries ClientScript.js';

                form.addSubmitButton({ label: 'Save' });



                var customerField = form.addField({
                    id: 'custpage_customer',
                    label: 'Select the Customer',
                    type: ui.FieldType.SELECT,
                });

                customerField.addSelectOption({
                    value : '7642243',
                    text : 'W10256623',
                    isSelected: true
                });

                var sublist = form.addSublist({
                    id: 'custpage_items_in_warehouse',
                    type: ui.SublistType.LIST,
                    label: 'Items in the Warehouse'
                });

                sublist.addField({
                    id: 'custpage_include_in_pd',
                    label: 'Include in Partial Delivery',
                    type: ui.FieldType.CHECKBOX
                })

                sublist.addField({
                    id: 'custpage_item',
                    label: 'SKU',
                    type: ui.FieldType.TEXT
                })

                sublist.addField({
                    id: 'custpage_item_name',
                    label: 'Item',
                    type: ui.FieldType.TEXT
                })

                sublist.addField({
                    id: 'custpage_quantity',
                    label: 'Quantity in Warehouse',
                    type: ui.FieldType.TEXT
                })

                sublist.addField({
                    id: 'custpage_date',
                    label: 'Arrived in Warehouse',
                    type: ui.FieldType.TEXT
                })

                var sublistIdField = sublist.addField({
                    id: 'custpage_so_id',
                    label: 'SO ID',
                    type: ui.FieldType.INTEGER
                })

                sublistIdField.updateDisplayType({
                        displayType : ui.FieldDisplayType.HIDDEN
                    });

                var lineId = sublist.addField({
                    id: 'custpage_line_id',
                    label: 'Line ID',
                    type: ui.FieldType.INTEGER
                })

                lineId.updateDisplayType({
                    displayType : ui.FieldDisplayType.HIDDEN
                });



                sublist.addButton({
                    id: 'selectall',
                    label: 'Select All',
                    functionName: 'selectall'
                })

                sublist.addButton({
                    id: 'selectnone',
                    label: 'Select None',
                    functionName: 'selectnone'
                })



                const salesorderSearchColItem = search.createColumn({ name: 'item' });
                const salesorderSearchColDisplayName = search.createColumn({ name: 'displayname', join: 'item' });
                const salesorderSearchColIncludeInPartialDelivery = search.createColumn({ name: 'custcol_include_in_partial', sort: search.Sort.ASC });
                const salesorderSearchColQuantityCommitted = search.createColumn({ name: 'quantitycommitted' });
                const salesorderSearchColLastCommittedDate = search.createColumn({ name: 'custcol_last_committed_date', sort: search.Sort.ASC });
                const salesorderSearchColInternalId = search.createColumn({ name: 'internalid' });
                const salesorderSearchColLineId = search.createColumn({ name: 'line' });
                const salesOrders = search.create({
                    type: 'salesorder',
                    filters: [
                        ['type', 'anyof', 'SalesOrd'],
                        'AND',
                        ['quantitycommitted', 'greaterthan', '0'],
                        'AND',
                        ['location', 'anyof', '1'],
                        'AND',
                        ['name', 'anyof', '7642243'],
                    ],
                    columns: [
                        salesorderSearchColItem,
                        salesorderSearchColDisplayName,
                        salesorderSearchColIncludeInPartialDelivery,
                        salesorderSearchColQuantityCommitted,
                        salesorderSearchColLastCommittedDate,
                        salesorderSearchColInternalId,
                        salesorderSearchColLineId,
                    ],
                });

                var counter = 0;
                salesOrders.run().each(function(result) {
                    log.debug("result", result);
                    const item = result.getText('item');
                    log.debug('item', item);
                    const displayName = result.getValue(salesorderSearchColDisplayName);
                    //const isPartialDelivery = result.getValue('custcol_include_in_partial');
                    //const formulaTextXEWGMJBJ = <string>result.getValue(salesorderSearchColFormulaTextXEWGMJBJ);
                    const includeInPartialDelivery = result.getValue(salesorderSearchColIncludeInPartialDelivery);
                    const quantityCommitted = result.getValue(salesorderSearchColQuantityCommitted);
                    const lastCommittedDate = result.getValue(salesorderSearchColLastCommittedDate);
                    const internalId = result.getValue(salesorderSearchColInternalId);
                    const lineId = result.getValue(salesorderSearchColLineId);

                    if(includeInPartialDelivery) { var incInPartialCB = 'T'} else {incInPartialCB ='F'}

                    sublist.setSublistValue({
                        id: 'custpage_include_in_pd',
                        line: counter,
                        value: incInPartialCB
                    });

                    sublist.setSublistValue({
                        id: 'custpage_item',
                        line: counter,
                        value: item
                    });

                    sublist.setSublistValue({
                        id: 'custpage_item_name',
                        line: counter,
                        value: displayName
                    });

                    sublist.setSublistValue({
                        id: 'custpage_quantity',
                        line: counter,
                        value: quantityCommitted
                    });

/*                    var parsedDate = format.parse({
                        value: lastCommittedDate,
                        type: format.Type.DATE
                    });*/

                    sublist.setSublistValue({
                        id: 'custpage_date',
                        line: counter,
                        value: lastCommittedDate
                    });

                    sublist.setSublistValue({
                        id: 'custpage_so_id',
                        line: counter,
                        value: internalId
                    });

                    sublist.setSublistValue({
                        id: 'custpage_line_id',
                        line: counter,
                        value: lineId
                    });


                    counter++;
                    return true;
                })
                context.response.writePage(form);
            } else if (context.request.method === 'POST') {

                var lineCount = context.request.getLineCount({
                    group: 'custpage_items_in_warehouse'
                });

                log.debug("Got lines", lineCount)


            }

        }

        return {onRequest}

        function getSalesOrders() {


            return salesorderSearch;
        }

    });
