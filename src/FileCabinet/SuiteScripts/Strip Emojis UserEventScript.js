/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 *  Remove emojis from contact notes
 *
 */
define(['N/record'],
    /**
 * @param{record} record
 */
    (record) => {


        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

            const note = scriptContext.newRecord

            const entry = note.getValue({
                fieldId: 'custrecord_cn_entry'
            })

            const stripped = entry.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');

            note.setValue({
                fieldId: 'custrecord_cn_entry',
                value: stripped
            })

        }



        return { beforeSubmit }

    });
