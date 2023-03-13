/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 *
 * Script to bypass UE not triggering on scheduled WF
 */
define(['N/record', 'N/runtime', 'N/format'],
    /**

 */
    (record, runtime, format) => {
        /**
         * Defines the WorkflowAction script trigger point.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.workflowId - Internal ID of workflow which triggered this action
         * @param {string} scriptContext.type - Event type
         * @param {Form} scriptContext.form - Current form that the script uses to interact with the record
         * @since 2016.1
         */
        const onAction = (scriptContext) => {

            log.debug('WFA running', scriptContext)

            const  recordToChange = scriptContext.newRecord;

            const recordType = recordToChange.type;

            const recordId = recordToChange.id

            const script = runtime.getCurrentScript();

            let fieldToChange = script.getParameter({name: 'custscript_wfa_field_to_change'});

            //let value = script.getParameter({name: 'custscript_wfa_field_value'});

            //if (!value) {
                //value = new Date()
            //}

           // const field = 'custentity_lnu'
            const d = new Date();
            const newValue = format.format({
                value: d,
                type: format.Type.DATETIMETZ
            });

            log.debug('Processing', [recordType, recordId, fieldToChange, d])

            const editedRecord = record.load({
                type: recordType,
                id: recordId
            })

            editedRecord.setValue({
                fieldId: fieldToChange,
                value: d
            });

            editedRecord.save()

        }

        return {onAction};
    });
