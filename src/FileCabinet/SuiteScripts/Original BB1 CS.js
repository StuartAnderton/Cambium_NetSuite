/**
 *
 * Client Script for on PO Suitelet
 *
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/record', 'N/ui/dialog', 'N/runtime','N/url'],

    function(currentRecord, record, dialog, runtime,url) {
        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */

        function pageInit(scriptContext) {


        }

        function bb1_markallButton() {

            var uiMessage = '';
            try {
                updateSublist('MarkAll');
            } catch (e) {
                uiMessage = message.create({
                    type: message.Type.ERROR,
                    title: 'Error',
                    message: e.message
                });
                uiMessage.show(); // show indefinitely
                return false;
            }
        }


        function bb1_unmarkallButton() {
            var uiMessage = '';
            try {
                updateSublist('UnmarkAll');
            } catch (e) {
                uiMessage = message.create({
                    type: message.Type.ERROR,
                    title: 'Error',
                    message: e.message
                });
                uiMessage.show(); // show indefinitely
                return false;
            }
        }

        function updateSublist(sublistAction) {
            var listItems = [];
            var updateSublistCheckbox = false;
            var recordObj = currentRecord.get();

            var count  = recordObj.getLineCount({
                sublistId: 'custpage_itemsublist'
            });

            switch (sublistAction) {
                case 'MarkAll': //'Mark all'
                    updateSublistCheckbox = true;
                    break;
                case 'UnmarkAll': //'UnMark all'
                    updateSublistCheckbox = false;
                    break;
                default:
                    return;//nothing
            }


            for(var i=0; i< count; i++){
                recordObj.selectLine({
                    sublistId: 'custpage_itemsublist',
                    line: i
                });

                var goodToGo = recordObj.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_list_goodtogo', line: i }) !== "";
                if (sublistAction == 'MarkAll')
                    updateSublistCheckbox = goodToGo;

                recordObj.setCurrentSublistValue({
                    sublistId: 'custpage_itemsublist',
                    fieldId: 'custpage_mark',
                    value: updateSublistCheckbox,
                    ignoreFieldChange: true,
                    fireSlavingSync: true
                });

                if(goodToGo === true){
                    var jsonValue = recordObj.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_json', line: i });
                    var hashValue = recordObj.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_hash', line: i });
                    var supplierId = recordObj.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_list_supplierid', line: i });
                    var itemJson = new Object();
                    itemJson.supplerid = supplierId;
                    itemJson.json = jsonValue;
                    itemJson.hash = hashValue;
                    listItems.push(itemJson);
                }
            }

            recordObj.setValue({
                fieldId: 'custpage_selectcheckboxsublist',
                value: JSON.stringify(listItems)
            });

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

            if (scriptContext.sublistId === 'custpage_itemsublist' && scriptContext.fieldId === 'custpage_mark'){
                var count = scriptContext.currentRecord.getLineCount({
                    sublistId: 'custpage_itemsublist'
                });
                var listcheckbox = [];
                var listItems = [];
                for(var i=0; i< count; i++)
                {
                    var mark = scriptContext.currentRecord.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_mark', line: i });
                    if(mark === true)
                    {

                        var jsonValue = scriptContext.currentRecord.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_json', line: i });
                        var jsonHash = scriptContext.currentRecord.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_hash', line: i });

                        var supplierId = scriptContext.currentRecord.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_list_supplierid', line: i });
                        var itemJson = new Object();
                        itemJson.supplerid = supplierId;
                        itemJson.json = jsonValue;
                        itemJson.hash = jsonHash;

                        listItems.push(itemJson);

                    }

                }

                scriptContext.currentRecord.setValue({
                    fieldId: 'custpage_selectcheckboxsublist',
                    value: JSON.stringify(listItems),
                    ignoreFieldChange: false
                });

            }

            if(scriptContext.fieldId == 'custpage_clicksupplier'){
                var supplierID = scriptContext.currentRecord.getValue({
                    fieldId: 'custpage_clicksupplier'
                });

                var lineCount  = scriptContext.currentRecord.getLineCount({
                    sublistId: 'custpage_itemsublist'
                });

                for(var i=0; i<lineCount; i++){
                    var currentID = scriptContext.currentRecord.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_list_supplierid', line: i });
                    if (supplierID == currentID)
                        break;
                }

                var currentJSON = scriptContext.currentRecord.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_json', line: i });
                if (currentJSON.indexOf("custpage_bigpo_") == 0){
                    currentJSON = scriptContext.currentRecord.getValue({
                        fieldId: "custpage_bigpo_" + supplierID
                    });
                }

                var currentHASH = scriptContext.currentRecord.getSublistValue({ sublistId: 'custpage_itemsublist', fieldId: 'custpage_hash', line: i });

                scriptContext.currentRecord.setValue({
                    fieldId: 'custpage_clicksupplier',
                    value: '',
                    ignoreFieldChange: true
                });

                runtime.getCurrentSession().set({
                    name: 'supplierid',
                    value: currentID
                });

                //alert(i + "\n" + currentID);
                createPo(currentID, currentJSON, currentHASH);

                return true;
            }

            var currentRecord = scriptContext.currentRecord;
            var sublistName = scriptContext.sublistId;
            var sublistFieldName = scriptContext.fieldId;
            if (sublistName === 'custpage_itemsublist' && sublistFieldName === 'custpage_mark'){

                var currIndex = currentRecord.getCurrentSublistIndex({
                    sublistId: 'custpage_itemsublist'
                });

                var GtoGo = scriptContext.currentRecord.getSublistValue({
                    sublistId: 'custpage_itemsublist',
                    fieldId: 'custpage_list_goodtogo',
                    line: currIndex
                }) != '';

                var thisMark = scriptContext.currentRecord.getSublistValue({
                    sublistId: 'custpage_itemsublist',
                    fieldId: 'custpage_mark',
                    line: currIndex
                });

                if (!GtoGo && thisMark){
                    /*
                    if (!confirm("Please confirm OK to create an approved PO although supplier is not marked Good to Go.\nOtherwise please Cancel.")){

                      currentRecord.selectLine({
          sublistId: 'custpage_itemsublist',
          line: currIndex
      });
      */
                    currentRecord.setCurrentSublistValue({
                        sublistId: sublistName,
                        fieldId: 'custpage_mark',
                        value: false
                    });
                    //}
                }

            }

            var currentRecord = scriptContext.currentRecord;
            var fieldChangedId = scriptContext.fieldId;
            var fieldChangedValue = currentRecord.getValue({
                fieldId: fieldChangedId
            });

            if((fieldChangedId==="custpage_supplier")||(fieldChangedId==="custpage_buyer")|| (fieldChangedId==="custpage_sortpoitem") || (fieldChangedId==="custpage_inc_prevendor") || (fieldChangedId==="custpage_exclude_uts") || (fieldChangedId==="custpage_is_available") || (fieldChangedId==="custpage_inc_excvendor"))
            {

                var custpage_inc_prevendor = currentRecord.getValue({
                    fieldId: 'custpage_inc_prevendor'
                });

                var custpage_inc_excvendor = currentRecord.getValue({
                    fieldId: 'custpage_inc_excvendor'
                });

                var custpage_is_available = currentRecord.getValue({
                    fieldId: 'custpage_is_available'
                });

                var custpage_exclude_uts = currentRecord.getValue({
                    fieldId: 'custpage_exclude_uts'
                });

                currentRecord.setValue({
                    fieldId: 'custpage_action',
                    value: fieldChangedId,
                    ignoreFieldChange: false
                });

                currentRecord.setValue({
                    fieldId: 'custpage_nextstep',
                    value: custpage_inc_prevendor + ':' + custpage_inc_excvendor + ':' + custpage_is_available + ':' + custpage_exclude_uts,
                    ignoreFieldChange: false
                });

                window.ischanged = false;
                document.main_form.submit();

            }
        }

        function refreshButton() {

            if (window.isinited && window.isvalid) {
                setWindowChanged(window, false);
                main_form.custpage_action.value = 'refresh';
                main_form.submit();
            }
        }

        function createApprovedOrders() {


            if (window.isinited && window.isvalid) {
                setWindowChanged(window, false);
                main_form.custpage_action.value = 'createapprovedorders';
                main_form.submit();
            }
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


        function createPo(supplierID, json, hash) {

            //alert("Create PO : " + supplierID + "\n" + json)

            var scheme = 'https://';
            var host = url.resolveDomain({
                hostType: url.HostType.APPLICATION
            });

            var relativePath = url.resolveRecord({
                recordType: record.Type.PURCHASE_ORDER,
                recordId: null,
                isEditMode: true
            });

            var createCustomRecord = record.create({
                type: 'customrecord_bb1_oi_json_supplier_data'
            });

            createCustomRecord.setValue({
                fieldId: 'custrecord_bb1_oi_supplier_lookup',
                value: supplierID
            });

            createCustomRecord.setValue({
                fieldId: 'custrecord_bb1_oi_po_json_data',
                value: json
            });

            createCustomRecord.setValue({
                fieldId: 'custrecord_bb1_oi_po_json_hash',
                value: hash
            });

            createCustomRecord.setValue({
                fieldId: 'custrecord_bb1_status',
                value: 5 //Created in Browser
            });

            var recordId = createCustomRecord.save();
            var output = scheme + host + relativePath +'&entity=' + supplierID + '&customrecord=' + recordId +'&openpo=openpo';

            //alert(runtime.getCurrentScript().getRemainingUsage());

            window.open( output,"bb1help",'width=1200px,height=900px,resizable=yes,scrollbars=yes');
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
            fieldChanged: fieldChanged,
            refreshButton:refreshButton,
            createApprovedOrders:createApprovedOrders,
            createPo:createPo,
            bb1_markallButton: bb1_markallButton,
            bb1_unmarkallButton: bb1_unmarkallButton
        };

    });