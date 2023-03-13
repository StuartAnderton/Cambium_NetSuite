/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

/* User event script to send details of a product to Oracle
 */

define(['N/https', 'N/runtime', 'N/search', 'N/record'],

    function (https, runtime, search, record) {

        function afterSubmit(context) {

            var headers;
            var url;
            var payload;
            var response;

            var script = runtime.getCurrentScript();
            var isProduction = runtime.envType === runtime.EnvType.PRODUCTION;
            if (isProduction) {
                var prefix = script.getParameter({name: 'custscript_production_prefix_item'})
            } else {
                prefix = script.getParameter({name: 'custscript_qa_prefix_item'})
            }
            // Search which defines the fields to send
            var itemSearchId = script.getParameter({name: 'custscript_item_search'})

            // Flag field used by WF to retry fails
            var flag = script.getParameter({name: 'custscript_sync_flag'})

            var item = context.newRecord;
            var oldItem = context.oldRecord;

            if (item.getValue('custitem_last_notifiable_update') === oldItem.getValue('custitem_last_notifiable_update') ||
                !item.getValue('custitem_last_notifiable_update')) {
                return
            }

            log.debug('item', item)

            var itemId = item.getValue('id');

            var itemSearch = search.load({
                id: itemSearchId
            });

            var searchResults = '';
            var defaultFilters = [];

            defaultFilters.push(search.createFilter({
                name: 'internalid',
                operator: search.Operator.ANYOF,
                values: itemId
            }));
            itemSearch.filters = defaultFilters;

            log.debug('Filters', defaultFilters)

            searchResults = itemSearch.run();

            var itemData = searchResults.getRange({start: 0, end: 1});

            log.debug('Results', itemData[0])

            if (!itemData[0]) {
                return
            }

            var itemType = itemData[0].recordType;
            log.debug('type', itemType)

            var itemValues = itemData[0].toJSON().values;
            log.debug('values', itemValues)

            try {
                // Headers
                headers = {
                    'Content-Type': 'application/json',
                    accept: 'application/json'
                };

                // Endpoint
                url = 'https://cambium-test.free.beeceptor.com';

                log.debug({title: 'URL', details: url})

                // Payload
                payload = itemValues;

                log.debug('Payload', payload)

                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload),
                });

                log.debug('Response', response)

                if (response.code == '200' || response.code == '204') {
                    log.audit('Product Update Sent', itemId);
                    if (item.getValue(flag) == 'T') {
                        setSyncFlag(itemId, itemType, flag, 'F')
                    }

                } else {
                    log.error({title: 'Request failed', details: response.body});
                    setSyncFlag(itemId, itemType, flag, 'T');
                }
            } catch (err) {
                log.error('Request failed', err);
                setSyncFlag(itemId, itemType, flag, 'T');
            }

        }

        function setSyncFlag(itemId, itemType, flag, value) {

            if (itemType == 'inventoryitem') {
                var typeVar = record.Type.INVENTORY_ITEM;
            } else {
                typeVar = record.Type.KIT_ITEM;
            }

            var itemToUpdate = record.load({
                type: typeVar,
                id: itemId
            });

            itemToUpdate.setValue({
                fieldId: flag,
                value: value
            });

            itemToUpdate.save();

            log.error('Flag set', itemId)

        }


        return {
            afterSubmit: afterSubmit
        };

    });
