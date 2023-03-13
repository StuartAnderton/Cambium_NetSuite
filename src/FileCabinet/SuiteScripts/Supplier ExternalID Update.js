/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define(['N/record', 'N/runtime'],
    function(record, runtime) {
        function onAction(scriptContext) {
            log.debug({
                title: 'Start Script'
            });
            var supplier = scriptContext.newRecord;
            var newExternalId =supplier.getValue({
                fieldId: 'custentity_new_cms_id'
            });
            supplier.setValue({
                fieldId: 'externalid',
                value: newExternalId
            });

            var id = supplier.save();

            return null;
        }
        return {
            onAction: onAction
        }
    });