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

            log.debug (itemId);

            var result = '';

            var count = 5;

            while (result != itemId && count > 0 ) {

                var item = record.load({
                    type: record.Type.VENDOR,
                    id: itemId
                });

                var externalId = 'I'  + itemId;

                item.setValue({
                    fieldId: 'externalid',
                    value: externalId
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