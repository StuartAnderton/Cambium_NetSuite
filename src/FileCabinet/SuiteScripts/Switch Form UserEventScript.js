/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/redirect'],
    /**

     */
    (record, redirect) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {


            var recNew = scriptContext.newRecord;
            log.debug('Running', recNew)
            log.debug('Context', scriptContext)
            log.debug('Type', scriptContext.type)


            var custOwningBrand = recNew.getValue({
                fieldId: 'custentity_owning_brand'
            })

            var outletForm = recNew.getValue({
                fieldId: 'custentity_outlet_form_flag'
            })

            var editMode
            if (scriptContext.type === 'view') {
                editMode = false
            } else {
                editMode = true
            }

            log.debug('Values', [recNew.id, custOwningBrand, outletForm, scriptContext.type])


            if (custOwningBrand == '13' && !outletForm) {

                var recordEdit = record.load({
                        type: record.Type.CUSTOMER,
                        id: recNew.id
                    }
                )

                recordEdit.setValue({
                    fieldId: 'custentity_outlet_form_flag',
                    value: true
                })

                recordEdit.save()

                redirect.toRecord({
                    type: record.Type.CUSTOMER,
                    id: recNew.id,
                    isEditMode: editMode,
                    parameters: {
                        cf: 195
                    }

                })
            }


            if (custOwningBrand == '13' && outletForm) {


                if (scriptContext.type === 'view') {
                    recordEdit = record.load({
                            type: record.Type.CUSTOMER,
                            id: recNew.id
                        }
                    )

                    recordEdit.setValue({
                        fieldId: 'custentity_outlet_form_flag',
                        value: false
                    })

                    recordEdit.save()
                } else {
                    recNew.setValue({
                        fieldId: 'custentity_outlet_form_flag',
                        value: false
                    })
                }
            }


        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

            var recNew = scriptContext.newRecord;


            recNew.setValue({
                fieldId: 'custentity_outlet_form_flag',
                value: false
            })


        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

        }

        return {beforeLoad, beforeSubmit}

    });
