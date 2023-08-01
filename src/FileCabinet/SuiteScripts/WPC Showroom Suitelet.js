/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/record', 'N/ui/serverWidget', 'N/search', 'N/task', 'N/url', 'N/runtime'],
    /**

     */
    (log, record, ui, search, task, url, runtime) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            log.debug('Running', scriptContext)

            if (scriptContext.request.method === 'GET') {
                // run on GET
                onGet(scriptContext);
            } else {
                //run on POST
                onPost(scriptContext);
            }

        }

        return {onRequest}

        function onGet(context) {

            const form = ui.createForm({title: 'Manage Items in Showroom'});

            var htmlHeader = form.addField({
                id: 'custpage_header',
                type: ui.FieldType.INLINEHTML,
                label: ' '
            }).updateLayoutType({
                layoutType: ui.FieldLayoutType.OUTSIDEABOVE
            }).updateBreakType({
                breakType: ui.FieldBreakType.STARTROW
            }).defaultValue = `
                <p style=\'font-size:14px;padding-left: 10px;\'>This page allows you to add or remove Items from the Showroom.</p>
                <p style=\'font-size:14px;padding-left: 10px;\'>Check the box against Items you wish to remove.</p>
                <p style=\'font-size:14px;padding-left: 10px;\'>Discontinued Items are pre-selected for removal - clear the checkbox if you want to keep them.</p>
                <p style=\'font-size:14px;padding-left: 10px;\'>You can add new Items on the Add New Items tab.</p>
                <p style=\'font-size:14px;padding-left: 10px;\'>Note that when you click the button to make the changes, they may take a few moments to process.</p>
                <br>
                <br>`;

            form.addSubmitButton({label: 'Remove Selected & Add New'});

            form.addTab({
                id: 'itemstab',
                label: 'Items in Showroom'
            })


            const unavailableSublist = form.addSublist({
                id: 'custpage_unavail_items_in_townhouse',
                type: ui.SublistType.LIST,
                label: 'Discontinued Items',
                tab: 'itemstab'
            });

            unavailableSublist.addField({
                id: 'custpage_remove',
                label: 'Remove',
                type: ui.FieldType.CHECKBOX
            })

            const unavailIdField = unavailableSublist.addField({
                id: 'custpage_itemid_u',
                label: 'NS ID',
                type: ui.FieldType.INTEGER
            })

            unavailIdField.updateDisplayType({
                displayType: ui.FieldDisplayType.HIDDEN
            });

            unavailableSublist.addField({
                id: 'custpage_item',
                label: 'SKU',
                type: ui.FieldType.TEXT
            })

            unavailableSublist.addField({
                id: 'custpage_brand',
                label: 'Brand',
                type: ui.FieldType.TEXT
            })

            unavailableSublist.addField({
                id: 'custpage_displayname',
                label: 'Item',
                type: ui.FieldType.TEXT
            })

            unavailableSublist.addField({
                id: 'custpage_status',
                label: 'Buying Status',
                type: ui.FieldType.TEXT
            })

            unavailableSublist.addField({
                id: 'custpage_mpn',
                label: 'MPN',
                type: ui.FieldType.TEXT
            })

            unavailableSublist.addField({
                id: 'custpage_upc',
                label: 'EAN/UPC',
                type: ui.FieldType.TEXT
            })

            unavailableSublist.addField({
                id: 'custpage_reason',
                label: 'ReasonC',
                type: ui.FieldType.TEXT
            })

            const inventoryitemSearchColInTwsTownhouse = search.createColumn({name: 'custitem_in_wpc_showroom'});
            const inventoryitemSearchColName = search.createColumn({name: 'itemid'});
            const inventoryitemSearchId = search.createColumn({name: 'internalid'});
            const inventoryitemSearchColUpc = search.createColumn({name: 'upccode'});
            const inventoryitemSearchColMpn = search.createColumn({name: 'mpn'});
            const inventoryitemSearchColBrand = search.createColumn({name: 'custitem_brand', sort: search.Sort.ASC});
            const inventoryitemSearchColDisplayName = search.createColumn({name: 'displayname', sort: search.Sort.ASC});
            const inventoryitemSearchColTwsBuyingStatus = search.createColumn({
                name: 'custitembuying_status_wpc',
                sort: search.Sort.ASC
            });
            const inventoryitemSearchColReason = search.createColumn({name: 'custitemdiscontinuation_reason'});

            const inventoryitemSearch = search.create({
                type: 'inventoryitem',
                filters: [
                    ['type', 'anyof', 'InvtPart'],
                    'AND',
                    ['custitem_in_wpc_showroom', 'is', 'T'],
                    'AND',
                    ['custitembuying_status_wpc', 'is', '5'],
                ],
                columns: [
                    inventoryitemSearchColInTwsTownhouse,
                    inventoryitemSearchColName,
                    inventoryitemSearchColBrand,
                    inventoryitemSearchColDisplayName,
                    inventoryitemSearchColTwsBuyingStatus,
                    inventoryitemSearchId,
                    inventoryitemSearchColUpc,
                    inventoryitemSearchColMpn,
                    inventoryitemSearchColReason
                ],
            });

            var counter = 0;
            const inventoryitemSearchPagedData = inventoryitemSearch.runPaged({pageSize: 1000});
            for (let i = 0; i < inventoryitemSearchPagedData.pageRanges.length; i++) {
                const inventoryitemSearchPage = inventoryitemSearchPagedData.fetch({index: i});
                log.debug('Search page', inventoryitemSearchPage)
                inventoryitemSearchPage.data.forEach(function (result) {

                    const inTwsTownhouse = result.getValue(inventoryitemSearchColInTwsTownhouse);
                    const name = result.getValue(inventoryitemSearchColName);
                    const brand = result.getText(inventoryitemSearchColBrand);
                    const displayName = result.getValue(inventoryitemSearchColDisplayName);
                    const twsBuyingStatus = result.getText(inventoryitemSearchColTwsBuyingStatus);
                    const itemId = result.getText(inventoryitemSearchId);
                    const mpn = result.getValue(inventoryitemSearchColMpn) || '';
                    const upc = result.getValue(inventoryitemSearchColUpc) || '';
                    const reason = result.getText(inventoryitemSearchColReason);

                    log.debug('MPN', result)


                    unavailableSublist.setSublistValue({
                        id: 'custpage_remove',
                        line: counter,
                        value: 'F'
                    });

                    unavailableSublist.setSublistValue({
                        id: 'custpage_item',
                        line: counter,
                        value: name
                    });

                    if(reason) {
                        unavailableSublist.setSublistValue({
                            id: 'custpage_reason',
                            line: counter,
                            value: reason
                        });
                    }

                    unavailableSublist.setSublistValue({
                        id: 'custpage_brand',
                        line: counter,
                        value: brand
                    });

                    unavailableSublist.setSublistValue({
                        id: 'custpage_displayname',
                        line: counter,
                        value: displayName
                    });

                    unavailableSublist.setSublistValue({
                        id: 'custpage_status',
                        line: counter,
                        value: twsBuyingStatus
                    });

                    unavailableSublist.setSublistValue({
                        id: 'custpage_itemid_u',
                        line: counter,
                        value: itemId
                    });

                    if (mpn) {
                        unavailableSublist.setSublistValue({
                            id: 'custpage_mpn',
                            line: counter,
                            value: mpn
                        });
                    }


                    if (upc) {
                        unavailableSublist.setSublistValue({
                            id: 'custpage_upc',
                            line: counter,
                            value: upc
                        });
                    }

                    counter = counter + 1;


                });
            }

            const availableSublist = form.addSublist({
                id: 'custpage_avail_items_in_townhouse',
                type: ui.SublistType.LIST,
                label: 'Other Items',
                tab: 'itemstab'
            });

            availableSublist.addField({
                id: 'custpage_remove_a',
                label: 'Remove',
                type: ui.FieldType.CHECKBOX
            })

            const availIdField = availableSublist.addField({
                id: 'custpage_itemid_a',
                label: 'NS ID',
                type: ui.FieldType.INTEGER
            })

            availIdField.updateDisplayType({
                displayType: ui.FieldDisplayType.HIDDEN
            });

            availableSublist.addField({
                id: 'custpage_item_a',
                label: 'SKU',
                type: ui.FieldType.TEXT
            })

            availableSublist.addField({
                id: 'custpage_brand_a',
                label: 'Brand',
                type: ui.FieldType.TEXT
            })

            availableSublist.addField({
                id: 'custpage_displayname_a',
                label: 'Item',
                type: ui.FieldType.TEXT
            })

            availableSublist.addField({
                id: 'custpage_status_a',
                label: 'Buying Status',
                type: ui.FieldType.TEXT
            })

            availableSublist.addField({
                id: 'custpage_mpn_a',
                label: 'MPN',
                type: ui.FieldType.TEXT
            })

            availableSublist.addField({
                id: 'custpage_upc_a',
                label: 'EAN/UPC',
                type: ui.FieldType.TEXT
            })

            availableSublist.addField({
                id: 'custpage_reason_a',
                label: 'Disc Reason',
                type: ui.FieldType.TEXT
            })


            const availInventoryitemSearch = search.create({
                type: 'inventoryitem',
                filters: [
                    ['type', 'anyof', 'InvtPart'],
                    'AND',
                    ['custitem_in_wpc_showroom', 'is', 'T'],
                    'AND',
                    ['custitembuying_status_wpc', 'noneof', '5'],
                ],
                columns: [
                    inventoryitemSearchColInTwsTownhouse,
                    inventoryitemSearchColName,
                    inventoryitemSearchColBrand,
                    inventoryitemSearchColDisplayName,
                    inventoryitemSearchColTwsBuyingStatus,
                    inventoryitemSearchId,
                    inventoryitemSearchColUpc,
                    inventoryitemSearchColMpn,
                    inventoryitemSearchColReason
                ],
            });

            counter = 0;
            const availInventoryitemSearchPagedData = availInventoryitemSearch.runPaged({pageSize: 1000});
            for (let i = 0; i < availInventoryitemSearchPagedData.pageRanges.length; i++) {
                const availInventoryitemSearchPage = availInventoryitemSearchPagedData.fetch({index: i});
                availInventoryitemSearchPage.data.forEach(function (result) {
                    const inTwsTownhouse = result.getValue(inventoryitemSearchColInTwsTownhouse);
                    const name = result.getValue(inventoryitemSearchColName);
                    const brand = result.getText(inventoryitemSearchColBrand);
                    const displayName = result.getValue(inventoryitemSearchColDisplayName);
                    const twsBuyingStatus = result.getText(inventoryitemSearchColTwsBuyingStatus);
                    const itemId = result.getValue(inventoryitemSearchId);
                    const mpn = result.getValue(inventoryitemSearchColMpn) || '';
                    const upc = result.getValue(inventoryitemSearchColUpc) || '';
                    const reason = result.getText(inventoryitemSearchColReason);


                    availableSublist.setSublistValue({
                        id: 'custpage_remove_a',
                        line: counter,
                        value: 'F'
                    });

                    availableSublist.setSublistValue({
                        id: 'custpage_item_a',
                        line: counter,
                        value: name
                    });

                    if(reason) {
                        availableSublist.setSublistValue({
                            id: 'custpage_reason_a',
                            line: counter,
                            value: reason
                        });
                    }

                    availableSublist.setSublistValue({
                        id: 'custpage_brand_a',
                        line: counter,
                        value: brand
                    });

                    availableSublist.setSublistValue({
                        id: 'custpage_displayname_a',
                        line: counter,
                        value: displayName
                    });

                    availableSublist.setSublistValue({
                        id: 'custpage_status_a',
                        line: counter,
                        value: twsBuyingStatus
                    });

                    availableSublist.setSublistValue({
                        id: 'custpage_itemid_a',
                        line: counter,
                        value: itemId
                    });

                    if (upc) {
                        availableSublist.setSublistValue({
                            id: 'custpage_upc_a',
                            line: counter,
                            value: upc
                        });
                    }

                    if (mpn) {
                        availableSublist.setSublistValue({
                            id: 'custpage_mpn_a',
                            line: counter,
                            value: mpn
                        });
                    }

                    counter = counter + 1;

                });
            }

            const newSublist = form.addSublist({
                id: 'custpage_new_items_in_townhouse',
                type: ui.SublistType.INLINEEDITOR,
                label: 'Add New Items',
                tab: 'itemstab'
            });

            newSublist.addField({
                id: 'custpage_item_n',
                label: 'SKU',
                type: ui.FieldType.SELECT,
                source: 'item'
            })

            context.response.writePage(form);

        }

        function onPost(context) {


            if (context.request.parameters.custpage_unavail_items_in_townhousedata) {
                var unavailable = context.request.parameters.custpage_unavail_items_in_townhousedata.split('\u0002')
            } else {
                unavailable = []
            }
            log.debug('Unavailable', unavailable)

            if (context.request.parameters.custpage_avail_items_in_townhousedata) {
                var available = context.request.parameters.custpage_avail_items_in_townhousedata.split('\u0002')
            } else {
                available = []
            }
            log.debug('Available', available)

            if (context.request.parameters.custpage_new_items_in_townhousedata) {
                var new_items = context.request.parameters.custpage_new_items_in_townhousedata.split('\u0002')
            } else {
                new_items = []
            }
            log.debug('New', new_items)

            var recordsToChange = []


            unavailable.forEach(function (line) {
                const lineFields = line.split('\u0001')

                if (lineFields[0] === 'T') {

                    recordsToChange.push(lineFields[1])

                }

            });


            available.forEach(function (line) {

                const lineFields = line.split('\u0001')

                if (lineFields[0] === 'T') {

                    recordsToChange.push(lineFields[1])

                }

            });

            log.debug('To unset', recordsToChange)

            if (recordsToChange) {

                let mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_remove_in_showroom',
                    deploymentId: 'customdeploy_remove_in_showroom',
                    params: {custscript_showroom_param: recordsToChange}
                });

                log.debug('Task', mrTask)

                // Submit the map/reduce task
                let mrTaskId = mrTask.submit();

                let taskStatus = task.checkStatus({
                    taskId: mrTaskId
                });

                log.debug('Submitted', [mrTaskId, taskStatus])

            }


            new_items.forEach(function (line) {

                const itemId = line.split('\u0001')[1]

                if (itemId) {

                    const addItem = record.load({
                            type: record.Type.INVENTORY_ITEM,
                            id: itemId
                        }
                    )

                    addItem.setValue({
                        fieldId: 'custitem_in_wpc_showroom',
                        value: true
                    })

                    addItem.save()

                    log.audit('Set to TRUE', itemId)
                }

            });


            let responsePage =
                `
                <body style="font-family:Open Sans,Helvetica,sans-serif;">
                <h1>Your changes are being processed</h1>

<p></p>
                It may take a few moments for the results to show,
                as the changes are done in the background.
                <p></p>

                `

            var forLink = url.resolveScript({
                scriptId: 'customscript_wpc_showroom',
                deploymentId: 'customdeploy_wpc_showroom',
                returnExternalUrl: true
            });

            responsePage = responsePage +
                '<A href="' + forLink + '">Reload page</A></body>'


            context.response.write(responsePage);

        }

    });