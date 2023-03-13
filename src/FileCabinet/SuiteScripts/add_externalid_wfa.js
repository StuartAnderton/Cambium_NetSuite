/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */

define(['N/record', 'N/runtime', 'N/format'],
    function(record, runtime, format) {
        function onAction(scriptContext) {

            log.debug ({
                    title:"Starting", 
                    details: scriptContext.newRecord
                });

            var itemId = scriptContext.newRecord.id;

            var itemType = scriptContext.newRecord.type;

            if (itemType != 'inventoryitem') {
                log.error ('Unsupported type', itemId + itemType);
                return
            }

            log.debug (itemId, itemType);

            var result = '';

            var count = 5;

            while (result != itemId && count > 0 ) {

                var item = record.load({
                    type: record.Type.INVENTORY_ITEM,
                    id: itemId
                });

                var externalId = 'PU' + ('0000' + itemId).slice(-8);

                item.setValue({
                    fieldId: 'externalid',
                    value: externalId
                });

                item.setValue({
                    fieldId: 'itemid',
                    value: externalId
                });

                var test = item.getValue({
                    fieldId: 'custitem_do_not_sync'
                });

                log.debug('Before', test)

                item.setValue({
                    fieldId: 'custitem_do_not_sync',
                    value: false
                });

                test = item.getValue({
                    fieldId: 'custitem_do_not_sync'
                });

                log.debug('After', test)

                item.setValue({
                    fieldId: 'custitem_last_notifiable_update',
                    value: new Date() 
                });

                try {
                    result = item.save();
                }
                catch (err) {
                    log.error('Save failed', itemId + count);
                }

                count = count - 1;

                log.debug (itemId, externalId);

            }

            return itemId;
        }

        return {
            onAction: onAction
        }
    });