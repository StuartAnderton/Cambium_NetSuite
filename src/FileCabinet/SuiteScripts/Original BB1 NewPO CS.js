/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/record', 'N/search', 'N/ui/dialog', 'N/runtime','N/url'],

    function(currentRecord, record, search, dialog, runtime,url) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext, currentRecord) {

            if (scriptContext.mode != "create") return true;

            var newPOrec = scriptContext.currentRecord;
            //var newPOrec = currentRecord;



            var customID = newPOrec.getValue({
                fieldId: 'custbody_bb1_pz_newpo_json_data_id'
            });

            if (isNaN(customID) || !customID) return true;

            newPOrec.setValue({
                fieldId: 'approvalstatus',
                value: 2
            });

            var fieldLookUp = search.lookupFields({
                type: 'customrecord_bb1_oi_json_supplier_data',
                id: customID,
                columns: ['custrecord_bb1_oi_po_json_data']
            });

            var json= fieldLookUp.custrecord_bb1_oi_po_json_data;

            //alert("New PO : " + customID + "\nJSON : " + json);

            var i =0;

            var jsonData = JSON.parse(json);
            log.debug('jsonData.length',jsonData.length);
            for (var i = 0; i < jsonData.length; i++) {

                var counter = jsonData[i];

                /*
                    newPOrec.selectNewLine({
                      sublistId: 'item'
                  });

                newPOrec.selectLine({
          sublistId: 'item',
          line: i
      });
      */
                newPOrec.insertLine({
                    sublistId: 'item',
                    line: i
                });

                newPOrec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: jsonData[i].item.toString(),
                    ignoreFieldChange: false,
                    forceSyncSourcing:true
                });

                newPOrec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: jsonData[i].qty,
                    ignoreFieldChange: false,
                    forceSyncSourcing:true
                });

                newPOrec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: jsonData[i].rate.toString(),
                    ignoreFieldChange: false,
                    forceSyncSourcing:true
                });

                newPOrec.commitLine({
                    sublistId: 'item'
                });

            }

            return true;

        }

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {

        }

        /**
         * Function to be executed when field is slaved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         *
         * @since 2015.2
         */
        function postSourcing(scriptContext) {

        }

        /**
         * Function to be executed after sublist is inserted, removed, or edited.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function sublistChanged(scriptContext) {

        }

        /**
         * Function to be executed after line is selected.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function lineInit(scriptContext) {

        }

        /**
         * Validation function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @returns {boolean} Return true if field is valid
         *
         * @since 2015.2
         */
        function validateField(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is committed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is inserted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateInsert(scriptContext) {

        }

        /**
         * Validation function to be executed when record is deleted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateDelete(scriptContext) {

        }

        /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
        function saveRecord(scriptContext) {

        }

        return {
            pageInit: pageInit
            /*
            fieldChanged: fieldChanged,
            postSourcing: postSourcing,
            sublistChanged: sublistChanged,
            lineInit: lineInit,
            validateField: validateField,
            validateLine: validateLine,
            validateInsert: validateInsert,
            validateDelete: validateDelete,
            saveRecord: saveRecord
            */
        };

    });