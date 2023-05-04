/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/record', 'N/ui/serverWidget', 'N/search'],
    /**

     */
    (log, record, ui, search) => {
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

            const form = ui.createForm({title: 'Manage Items in Townhouse'});

            form.addSubmitButton({label: 'Remove Selected & Add New'});

            form.addTab({
                id: 'itemstab',
                label: 'Items in Townhouse'
            })



            const unavailableSublist = form.addSublist({
                id: 'custpage_unavail_items_in_townhouse',
                type: ui.SublistType.LIST,
                label: 'Unavailable Items',
                tab: 'itemstab'
            });

            unavailableSublist.addField({
                id: 'custpage_remove',
                label: 'Remove',
                type: ui.FieldType.CHECKBOX
            })

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

            const inventoryitemSearchColInTwsTownhouse = search.createColumn({name: 'custitemin_townhouse'});
            const inventoryitemSearchColName = search.createColumn({name: 'itemid'});
            const inventoryitemSearchId = search.createColumn({name: 'internalid'});
            const inventoryitemSearchColBrand = search.createColumn({name: 'custitem_brand', sort: search.Sort.ASC});
            const inventoryitemSearchColDisplayName = search.createColumn({name: 'displayname', sort: search.Sort.ASC});
            const inventoryitemSearchColTwsBuyingStatus = search.createColumn({
                name: 'custitembuying_status_tws',
                sort: search.Sort.ASC
            });
            const inventoryitemSearch = search.create({
                type: 'inventoryitem',
                filters: [
                    ['type', 'anyof', 'InvtPart'],
                    'AND',
                    ['custitemin_townhouse', 'is', 'T'],
                    'AND',
                    ['custitembuying_status_tws', 'noneof', '1'],
                ],
                columns: [
                    inventoryitemSearchColInTwsTownhouse,
                    inventoryitemSearchColName,
                    inventoryitemSearchColBrand,
                    inventoryitemSearchColDisplayName,
                    inventoryitemSearchColTwsBuyingStatus,
                ],
            });

            var counter = 0;
            const inventoryitemSearchPagedData = inventoryitemSearch.runPaged({pageSize: 1000});
            for (let i = 0; i < inventoryitemSearchPagedData.pageRanges.length; i++) {
                const inventoryitemSearchPage = inventoryitemSearchPagedData.fetch({index: i});
                inventoryitemSearchPage.data.forEach(function (result) {
                    const inTwsTownhouse = result.getValue(inventoryitemSearchColInTwsTownhouse);
                    const name = result.getValue(inventoryitemSearchColName);
                    const brand = result.getText(inventoryitemSearchColBrand);
                    const displayName = result.getValue(inventoryitemSearchColDisplayName);
                    const twsBuyingStatus = result.getText(inventoryitemSearchColTwsBuyingStatus);

                    unavailableSublist.setSublistValue({
                        id: 'custpage_remove',
                        line: counter,
                        value: 'T'
                    });

                    unavailableSublist.setSublistValue({
                        id: 'custpage_item',
                        line: counter,
                        value: name
                    });

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

                    counter = counter + 1;

                });
            }

            const availableSublist = form.addSublist({
                id: 'custpage_avail_items_in_townhouse',
                type: ui.SublistType.LIST,
                label: 'Available Items',
                tab: 'itemstab'
            });

            availableSublist.addField({
                id: 'custpage_remove_a',
                label: 'Remove',
                type: ui.FieldType.CHECKBOX
            })

            availableSublist.addField({
                id: 'custpage_itemid_a',
                label: 'NS ID',
                type: ui.FieldType.INTEGER
            })

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


            const availInventoryitemSearch = search.create({
                type: 'inventoryitem',
                filters: [
                    ['type', 'anyof', 'InvtPart'],
                    'AND',
                    ['custitemin_townhouse', 'is', 'T'],
                    'AND',
                    ['custitembuying_status_tws', 'is', '1'],
                ],
                columns: [
                    inventoryitemSearchColInTwsTownhouse,
                    inventoryitemSearchColName,
                    inventoryitemSearchColBrand,
                    inventoryitemSearchColDisplayName,
                    inventoryitemSearchColTwsBuyingStatus,
                    inventoryitemSearchId
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

            var unavailable = context.request.parameters.custpage_unavail_items_in_townhousedata.split('\u0002')
            log.debug('Unavailable', unavailable)
            var available = context.request.parameters.custpage_avail_items_in_townhousedata.split('\u0002')
            log.debug('Available', available)
            var new_items = context.request.parameters.custpage_new_items_in_townhousedata.split('\u0002')
            log.debug('New', new_items)

            var recordsToChange = []

            unavailable.forEach(function(line){
                var lineFields = line.split('\u0001')

            });

            available.forEach(function(line){

            });

            new_items.forEach(function(line){

            });



        }

    });
