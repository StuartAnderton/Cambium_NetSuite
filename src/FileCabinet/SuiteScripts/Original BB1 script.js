/**
 *
 * Version    Date            Author           	Remarks
 * 1.00       15 Mar 2019     Paul Collins		Initial release
 * 2.00       02 Mar 2020     Leigh Darby		Changes for 1W upgrade / tax schedules replacing tax codes
 * 2.10       08 Aug 2020     Leigh Darby	   	Changes for search by locations
 * 2.20       20 Oct 2021     Stuart Anderton   Add "Available Only" filter
 *
 * Project: P100916 Netsuite ERP Implementation
 * (http://teamwork.bluebridgeone.com/#/projects/320422/tasks)
 *
 * Task: 1223136 Dev Gap - Solution for placing purchase orders
 * (http://teamwork.bluebridgeone.com/#tasklists/1223136)
 *
 * As indicated in the requirements document - ï¿½Specification for Placing Purchase Orders in Netsuiteï¿½ - see Appendix A.
 * The overall objective is described as  :-
 *
 * The philosophy will be to introduce a process which dictates minimal manual intervention where the placing of purchase orders is in line with
 * certain rules but allows the user to intervene and change/add/delete order amounts as they wish prior to placing a purchase order.
 * To this end - Prezola have a current system (Pronto) which contains several features that are not available in the standard NetSuite supplier / vendor order items interface (i.e. the page at standard menu item Transactions > Purchases > Order Items).
 *
 * Whilst Prezola indicate it is not a requirement (or even desirable) to ï¿½cloneï¿½ the existing Pronto interface or functionality per se -
 * since NetSuite also overcomes shortcomings in Pronto - the following features / concepts are useful and need to be part of a customised solution :-
 *
 * Minimum order value (MOV) - a custom currency field on the supplier record
 * Carriage Paid (CP) - a custom currency field on the supplier record indicating the order value over which it is paid
 * PO authorisation flexibility - orders will require approval if additional ad-hoc items are added, otherwise not
 *
 * Also, any customisation should not affect the ability to place any ad-hoc standard POs at any time.
 *
 * Copyright (c) 2019 BlueBridge One Business Solutions, All Rights Reserved
 * support@bluebridgeone.com, +44 (0)1932 300007
 *
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/http', 'N/https', 'N/ui/serverWidget', 'N/email', 'N/runtime', 'N/task', 'N/search','N/redirect','N/record','N/url'],

    function(http, https, serverWidget, email, runtime, task, search, redirect,record, url) {

        // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
        String.prototype.hashCode = function() {
            var hash = 0, i = 0, len = this.length;
            while ( i < len ) {
                hash  = ((hash << 5) - hash + this.charCodeAt(i++)) << 0;
            }
            return hash;
        };

        /**
         *  Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */

        function onRequest(context) {

            var request = context.request;
            log.debug('request.method', request.method);
            log.debug('request_parameters', request.parameters);
            var action = request.parameters.custpage_action||'';
            var nextstep = request.parameters.custpage_nextstep||'';
            var buyerValue = request.parameters.custpage_buyer||'';
            var sortItem = request.parameters.custpage_sortpoitem||'';
            var supplierValue = request.parameters.custpage_supplier||'';
            var itemWithNoPrefVend_chk = request.parameters.custpage_inc_prevendor||'F';
            var itemVendorNotPreferred = request.parameters.custpage_inc_excvendor||'F';//Include items where vendor is not preferred
            // SWA NEW CODE
            var available = request.parameters.custpage_is_available||'F';
            var excludeUts = request.parameters.custpage_exclude_uts||'F'

            // END NEW CODE

            nextstep = nextstep.split(":");
            itemWithNoPrefVend_chk = nextstep[0];
            itemVendorNotPreferred = nextstep[1];
            available = nextstep[2];
            excludeUts = nextstep[3];
            log.debug('excldueUts', excludeUts)
            nextstep = request.parameters.custpage_nextstep;

            var form = serverWidget.createForm({
                title: 'Cambium - Item Ordering',
                hideNavBar: false
            });

            if(nextstep === 'custpage_buyer'){
                if(buyerValue ==='')
                    supplierValue='';
            }

            var currentUserId = runtime.getCurrentUser().id;
            form.clientScriptModulePath = "SuiteScripts/[Prezola] - BB1 P100916 Auto Supplier Orders/bb1_pz_autosuppord_cl.js";

            if (context.request.method === 'GET')
                createForm(form,'',currentUserId,'','','', '');
            else if ((context.request.method === 'POST')&& (request.parameters.custpage_action === 'refresh')) //createForm(form,'','','','','');
                createForm(form,supplierValue,buyerValue,sortItem,itemWithNoPrefVend_chk,itemVendorNotPreferred, available);
            else if ((context.request.method === 'POST')&& (request.parameters.custpage_action === 'createapprovedorders')){
                var checksublistJson =  request.parameters.custpage_selectcheckboxsublist ||'';
                log.debug('checksublistJson',checksublistJson);
                if(checksublistJson !== ''){

                    var jsonData = JSON.parse(checksublistJson);

                    var JSONsupplierIDs = [];
                    for (var s = 0; s < jsonData.length; s++)
                        JSONsupplierIDs.push(jsonData[s].supplerid);

                    var ignoreJSONsupplierIDs = ignoreSupplierIDs(JSONsupplierIDs);

                    for (var u = 0; u < jsonData.length; u++) {
                        var jsonSupplier = jsonData[u].supplerid;
                        var doSupplier = true;
                        for (var i = 0; i < ignoreJSONsupplierIDs.length; i++){
                            if (jsonSupplier === ignoreJSONsupplierIDs[i])
                                doSupplier = false;
                        }

                        if (doSupplier){

                            var jsonValue = jsonData[u].json;
                            var jsonHash = jsonData[u].hash;

                            var recStatus = 1; // Waiting
                            var hashCode = jsonHash;
                            if (hashCode && !isNaN(hashCode))
                                hashCode = hashCode*1; // Force to integer

                            // See if this unique hash code has already created a PO
                            var dupSearch = search.create({
                                type: "customrecord_bb1_oi_json_supplier_data",
                                columns:[
                                    search.createColumn({
                                        name: 'internalid'
                                    })],
                                filters: [
                                    search.createFilter({
                                        name: 'custrecord_bb1_oi_po_json_hash',
                                        join: null,
                                        operator: search.Operator.EQUALTO,
                                        values: hashCode
                                    }),
                                    search.createFilter({
                                        name: 'custrecord_bb1_oi_json_data_po_lookup',
                                        operator: search.Operator.NONEOF,
                                        values: "@NONE@"
                                    })
                                ]
                            });
                            var recCount=0;
                            dupSearch.run().each( function(srchResult) {
                                recCount++;
                                return true;    // continue iteration

                            });

                            if (recCount != 0)
                                var recStatus = 6; // Duplicated as already a PO exists

                            log.debug("jsonSupplier : " + jsonSupplier + "  recCount : " + recCount + "  recStatus : " + recStatus, hashCode);

                            if (jsonValue.indexOf("custpage_bigpo_") == 0){
                                jsonValue = request.parameters["custpage_bigpo_" + jsonSupplier];
                                log.debug("custpage_bigpo_" + jsonSupplier);
                            }

                            var createCustomRecord = record.create({
                                type: 'customrecord_bb1_oi_json_supplier_data'
                            });

                            createCustomRecord.setValue({
                                fieldId: 'custrecord_bb1_oi_supplier_lookup',
                                value: jsonSupplier
                            });

                            createCustomRecord.setValue({
                                fieldId: 'custrecord_bb1_oi_po_json_data',
                                value: jsonValue
                            });

                            createCustomRecord.setValue({
                                fieldId: 'custrecord_bb1_oi_po_json_hash',
                                value: jsonHash
                            });

                            createCustomRecord.setValue({
                                fieldId: 'custrecord_bb1_status',
                                value: recStatus
                            });

                            var recordId = createCustomRecord.save();
                        }
                    }

                    var loadTask = task.create({
                        taskType		: task.TaskType.SCHEDULED_SCRIPT,
                        scriptId		: 'customscript_bb1_create_po_approved',
                        deploymentId	: 'customdeploy_bb1_create_po_approved',
                        params		: {}
                    });

                    loadTask.submit();

                }

                createForm(form,supplierValue,buyerValue,sortItem,itemWithNoPrefVend_chk,itemVendorNotPreferred, available);

            }
            else if ((context.request.method === 'POST')&& (request.parameters.custpage_action === 'createordersforapproval')){

            }
            else
                createForm(form,supplierValue,buyerValue,sortItem,itemWithNoPrefVend_chk,itemVendorNotPreferred, available, excludeUts);

            var request = context.request;


            context.response.addHeader({
                name: 'X-XSS-Protection',
                value: '0'
            });

            context.response.writePage(form);
        }


        function createForm(form, supplierValue, buyerValue, sortItem, itemWithNoPrefVend_chk,itemVendorNotPreferred, available, excludeUts){
            var relativePath ='';
            var output ='';
            var action = form.addField({
                id: 'custpage_action',
                type: serverWidget.FieldType.TEXT,
                label: 'Action'
            });

            action.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            var scheme = 'https://';
            var host = url.resolveDomain({
                hostType: url.HostType.APPLICATION
            });

            var nextStep = form.addField({
                id: 'custpage_nextstep',
                type: serverWidget.FieldType.TEXT,
                label: 'Next Step'
            });

            nextStep.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            var selectCheckbox = form.addField({
                id: 'custpage_selectcheckboxsublist',
                type: serverWidget.FieldType.TEXTAREA,
                label: 'Select'
            });

            selectCheckbox.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            var buyer = form.addField({
                id: 'custpage_buyer',
                type: serverWidget.FieldType.SELECT,
                label: 'Buyer (All Buyer Employees)'
            });

            var columnsSrch = [];
            var asignBuyerColumn = search.createColumn({
                name: 'custentity_bb1_buyer',
                summary: "GROUP"
            });

            columnsSrch.push(asignBuyerColumn);
            var employeeSearch = search.create({
                type: search.Type.VENDOR,
                columns:[
                    search.createColumn({
                        name: 'custentity_bb1_buyer',
                        summary: 'GROUP'
                    })],
                filters: [
                    search.createFilter({
                        name: 'custentity_bb1_buyer',
                        join: null,
                        operator: search.Operator.ISNOTEMPTY
                    })
                ]
            });

            buyer.addSelectOption({value: '',text: ''});

            employeeSearch.run().each( function(srchResult) {
                if(srchResult.getValue({ name: 'custentity_bb1_buyer' , summary: 'GROUP' }) !== '')
                    buyer.addSelectOption({value: srchResult.getValue({ name: 'custentity_bb1_buyer' , summary: 'GROUP' }),text: srchResult.getText({ name: 'custentity_bb1_buyer' , summary: 'GROUP' })});

                return true;    // continue iteration

            });

            if(buyerValue !=='')
                buyer.defaultValue = buyerValue.toString();

            var supplier = form.addField({
                id: 'custpage_supplier',
                type: serverWidget.FieldType.SELECT,
                label: 'Supplier(Vendor)'
            });
            supplier.addSelectOption({value: '',text: ''});

            var soPoItem = form.addField({
                id: 'custpage_sortpoitem',
                type: serverWidget.FieldType.SELECT,
                label: 'Sorting of Purchase Order Items'
            });

            var srchColumns = [];
            var seqSortColumn = search.createColumn({
                name: "custrecord_bb1_sort_seq",
                sort: search.Sort.ASC
            });

            var sortCriteraColumn = search.createColumn({
                name: "custrecord_bb1_oi_sorting_critera"
            });
            srchColumns.push(seqSortColumn,sortCriteraColumn, 'name');

            var sortingPoItemSearch = search.create({
                type: 'customrecord_bb1_po_sort_criteria',
                columns: srchColumns,
                filters: [ search.createFilter({
                    name: 'isinactive',
                    operator: search.Operator.IS,
                    values: 'F'
                })]
            });

            soPoItem.addSelectOption({value: '',text: ''});

            sortingPoItemSearch.run().each( function(srchResult) {
                soPoItem.addSelectOption({value: srchResult.getValue({ name: 'custrecord_bb1_oi_sorting_critera' }),text: srchResult.getValue({ name: 'name' })});
                return true;    // continue iteration

            });


            if(sortItem !=='')
                soPoItem.defaultValue = sortItem.toString();

            srchColumns = [];
            var srchFilters = [];
            var internalIDColumn = search.createColumn({
                name: "internalid"
            });

            var entityIdColumn = search.createColumn({
                name: "entityid"
            });

            var buyerIdColumn = search.createColumn({
                name: "custentity_bb1_buyer"
            });

            srchColumns.push(entityIdColumn, internalIDColumn, buyerIdColumn);

            var inactiveFilters= search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: 'F'
            });

            log.debug('buyerValue: ' + buyerValue + " supplierValue: " + supplierValue);

            srchFilters.push(inactiveFilters);
            var buyerFilters='';
            if(buyerValue !=='' && buyerValue){
                buyerFilters= search.createFilter({
                    name: 'custentity_bb1_buyer',
                    operator: search.Operator.ANYOF,
                    values: buyerValue
                });
                srchFilters.push(buyerFilters);
            }
            else{
                buyerFilters= search.createFilter({
                    name: 'custentity_bb1_buyer',
                    operator: search.Operator.ISEMPTY
                }); //values: '@NONE@'
                srchFilters.push(buyerFilters);
            }

            /*

         var supplierSearch = search.create({
            type: 'vendor',
            columns: srchColumns,
            filters: srchFilters
            });

        var supplierCount = 0;
        supplierSearch.run().each( function(srchResult) {
           log.debug('buyerValue: ' + buyerValue + " supplierSearch: " + srchResult.getValue({ name: 'custentity_bb1_buyer' }));
          if (srchResult.getValue({ name: 'custentity_bb1_buyer' }) == buyerValue){
            supplier.addSelectOption({
                value: srchResult.getValue({ name: 'internalid' }),
                text: srchResult.getValue({ name: 'entityid' })
                });
               supplierCount++;
          }
                return true;    // continue iteration
                });

        if(supplierValue !=='')
            supplier.defaultValue = supplierValue;
             */

            var inc_prevendor = form.addField({
                id: 'custpage_inc_prevendor',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Include items with no preferred vendor'
            });

            inc_prevendor.updateDisplaySize({
                height: 60,
                width: 50
            });


            if(itemWithNoPrefVend_chk === 'true')
                inc_prevendor.defaultValue = 'T';
            else
                inc_prevendor.defaultValue = 'F';


            var exc_prevendor = form.addField({
                id: 'custpage_inc_excvendor',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Include items where vendor is not preferred'
            });

            exc_prevendor.updateDisplaySize({height: 60, width: 50});


            //// SWA NEW CODE

            var is_available = form.addField({
                id: 'custpage_is_available',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Include only Available items'
            });

            is_available.updateDisplaySize({height: 60, width: 50});

            var exclude_uts = form.addField({
                id: 'custpage_exclude_uts',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Exclude UTS and Under Review items'
            });

            exclude_uts.updateDisplaySize({height: 60, width: 50});



            if(available === 'true')
                is_available.defaultValue = 'T';
            else
                is_available.defaultValue = 'F';

            if(excludeUts === 'true')
                exclude_uts.defaultValue = 'T';
            else
                exclude_uts.defaultValue = 'F';


            /// END NEW CODE

            if(itemVendorNotPreferred === 'true')
                exc_prevendor.defaultValue = 'T';
            else
                exc_prevendor.defaultValue = 'F';

            var click_supplierid = form.addField({
                id: 'custpage_clicksupplier',
                type: serverWidget.FieldType.INTEGER,
                label: ' '
            });

            form.addButton({
                id : 'refresh',
                label : 'Refresh',
                functionName : 'refreshButton',
            });

            form.addButton({
                id : 'createapprovedorders',
                label : 'Create Approved Orders',
                functionName : 'createApprovedOrders',
            });

            var poButton = form.addButton({
                id : 'createordersforapproval',
                label : 'Create Orders For Approval',
                functionName : 'createPo'
            });

            poButton.isHidden = true;

            // ****** CREATE SUBLIST HERE ******
            var itemList = form.addSublist( {
                id: 'custpage_itemsublist',
                type : serverWidget.SublistType.LIST,
                label: 'Suppliers requiring POs'
            });

            //CREATE SUBLIST COLUMNS
            var mark = itemList.addField({
                id: 'custpage_mark',
                label: 'Select',
                type: serverWidget.FieldType.CHECKBOX
            });

            itemList.addField({
                id: 'custpage_list_goodtogo',
                label: 'Good To Go',
                type: serverWidget.FieldType.TEXT
            });

            var pendingpoHiddenColunm = itemList.addField({
                id: 'custpage_list_pendingpo_hidden',
                label: 'Pending po',
                type: serverWidget.FieldType.TEXT
            });

            pendingpoHiddenColunm.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            var POclicksHiddenColumn = itemList.addField({
                id: 'custpage_list_clickspo_hidden',
                label: 'Pending po',
                type: serverWidget.FieldType.INTEGER
            });

            POclicksHiddenColumn.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            POclicksHiddenColumn.defaultValue = 0;

            itemList.addField({
                id: 'custpage_list_postoapprove',
                label: 'Pending POs',
                type: serverWidget.FieldType.TEXT
            });

            var itemIDColunm = itemList.addField({
                id: 'custpage_list_itemid',
                label: 'Item ID',
                type: serverWidget.FieldType.TEXT
            });

            itemIDColunm.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            itemList.addField({
                id: 'custpage_list_supplier',
                label: 'Supplier',
                type: serverWidget.FieldType.TEXT
            });

            var supplierId = itemList.addField({
                id: 'custpage_list_supplierid',
                label: 'SupplierId',
                type: serverWidget.FieldType.TEXT
            });

            supplierId.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            var JSONfield = itemList.addField({
                id: 'custpage_json',
                type: serverWidget.FieldType.TEXTAREA,
                label: 'JSON'
            });

            JSONfield.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            var HASHfield = itemList.addField({
                id: 'custpage_hash',
                type: serverWidget.FieldType.TEXT,
                label: 'HASH'
            });

            HASHfield.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            itemList.addField({
                id: 'custpage_list_availcredit',
                label: 'Avail Credit',
                type: serverWidget.FieldType.CURRENCY
            });

            itemList.addField({
                id: 'custpage_list_mov',
                label: 'MOV',
                type: serverWidget.FieldType.CURRENCY
            });

            var valueFld= itemList.addField({
                id: 'custpage_list_value',
                label: 'Total Order Value',
                type: serverWidget.FieldType.CURRENCY
            });

            var cp = itemList.addField({
                id: 'custpage_list_carriagepaid',
                label: 'Carriage Paid (Value)',
                type: serverWidget.FieldType.CURRENCY
            });

            itemList.addField({
                id: 'custpage_list_mincarriagepaid',
                label: 'Carriage Paid (Reached? (Y/N)',
                type: serverWidget.FieldType.TEXT
            });

            itemList.addField({
                id: 'custpage_list_acceptsbackorders',
                label: 'HOLDS BOs',
                type: serverWidget.FieldType.TEXT
            });

            itemList.addField({
                id: 'custpage_list_status',
                label: 'Proc. Status',
                type: serverWidget.FieldType.TEXT
            });

            itemList.addField({
                id: 'custpage_list_lastpodate',
                label: 'Last PO Approved Date',
                type: serverWidget.FieldType.TEXT
            });



            var itemQty = itemList.addField({
                id: 'custpage_list_qty',
                label: 'Quantity',
                type: serverWidget.FieldType.TEXT
            });

            itemQty.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            itemList.addButton({
                id: 'custpage_markall',
                label: 'Mark All',
                functionName: 'bb1_markallButton'
            });
            itemList.addButton({
                id: 'custpage_unmarkall',
                label: 'UnMark All',
                functionName: 'bb1_unmarkallButton'
            });

            // Version 2.1 - added a search ID parameter, location based searches now ...
            var itemSearchID = runtime.getCurrentScript().getParameter("custscript_bb1_pz_item_search_lookup_id");
            var itemSearch = search.load({
                id: itemSearchID
            });

            var itemSearchResults = [];
            var defaultFilters = itemSearch.filters;
            if (supplierValue!== null){

                if (buyerValue != 'blank' && buyerValue != null && buyerValue != ''){
                    defaultFilters.push(search.createFilter({
                        name: 'custentity_bb1_buyer',
                        operator: search.Operator.ANYOF,
                        join: 'vendor',
                        values: buyerValue
                    }));
                }else{
                    defaultFilters.push(search.createFilter({
                        name: 'custentity_bb1_buyer',
                        operator: search.Operator.ISNOTEMPTY,
                        join: 'vendor'
                    }));
                }

                log.debug('sortItem',sortItem);
                if(sortItem !== ''){
                    var defaultColumns = itemSearch.columns;
                    defaultColumns.push(search.createColumn({
                        name: sortItem, //'mpn',
                        sort: search.Sort.ASC
                    }));
                    itemSearch.column = defaultColumns;
                }

                if(itemWithNoPrefVend_chk === 'true'){
                    defaultFilters.push(search.createFilter({
                        name: 'ispreferredvendor',
                        operator: search.Operator.IS,
                        values: false //true
                    }));
                }

                /// SWA NEW CODE

                if(available === 'true'){
                    defaultFilters.push(search.createFilter({
                        name: 'custitem_bb1_item_status',
                        operator: search.Operator.IS,
                        values: 4
                    }));
                }

                if(excludeUts === 'true'){
                    defaultFilters.push(search.createFilter({
                        name: 'custitem_bb1_item_status',
                        operator: search.Operator.NONEOF,
                        values: [9, 7]
                    }));
                }

                // END NEW CODE

                log.debug('supplierValue',supplierValue);
                if (supplierValue != 'blank' && supplierValue != null && supplierValue != ''){
                    if(itemVendorNotPreferred === 'true'){

                        /*defaultFilters.push(search.createFilter({
                        name: 'vendor',
                        operator: search.Operator.NONEOF,
                        join: 'preferredvendor',
                        values: supplierValue
                        }));*/ //need to fix this filter "Include items where vendor is not preferred"
                    }

                    defaultFilters.push(search.createFilter({
                        name: 'vendor',
                        operator: search.Operator.ANYOF,
                        values: supplierValue
                    }));

                    itemSearch.filters = defaultFilters;
                }

                log.debug('Search Filters', defaultFilters)

                var timeOutMSecs = runtime.getCurrentScript().getParameter("custscript_bb1_pz_itemsearch_max_seconds"); // seconds provided
                timeOutMSecs = timeOutMSecs * 1000; // milliseconds
                var d = new Date();
                var startMSecs = d.getTime();
                var intervalSecs = startMSecs;

                var itemResultSet = itemSearch.run().getRange({
                    start: 0,
                    end: 1000
                });
                log.debug('itemResultSet.length', itemResultSet.length);

                for (sr = 1; sr <= 30; sr++) {
                    var itemResultSetTemp = itemSearch.run().getRange({
                        start: sr*1000 + 1,
                        end: (sr+1)*1000
                    });
                    if (itemResultSetTemp.length == 0)
                        break;
                    itemResultSet = itemResultSet.concat(itemResultSetTemp);

                    var dx = new Date();
                    var durationMSecs = dx.getTime() - startMSecs ;
                    if (timeOutMSecs < durationMSecs){
                        break;
                    }
                    log.debug('itemResultSetTemp.length : ' + sr, itemResultSetTemp.length + " durationMSecs : " + durationMSecs + " intervalSecs : " + ((dx.getTime() - intervalSecs)/1000).toFixed(1));

                    intervalSecs = dx.getTime();

                }

                // Added location based processing in v2.1
                var supplierCount = 0;
                var prevSupplierID = 0;
                var currentItemID = 0;
                var currentItemQty = 0;
                //var currentPackSizeAmount = 0;
                var prevItemID = 0;
                var locationBasedQty = 0;
                var locationBasedPackSizeAmount = 0;
                var supplierList =[];

                for (i = 0; i < itemResultSet.length; i++) {

                    currentItemID = itemResultSet[i].getValue({name: 'internalid'});
                    currentItemQty = itemResultSet[i].getValue("formulanumeric")||0;
                    // currentPackSizeAmount = itemResultSet[i].getValue("formulacurrency")||0;


                    // I think this is to catch multiple lines per location, so not actually needed?

                    if (currentItemID == prevItemID){
                        locationBasedQty = parseFloat(locationBasedQty) + parseFloat(currentItemQty);
                        // locationBasedPackSizeAmount = parseFloat(locationBasedPackSizeAmount) + parseFloat(currentPackSizeAmount);
                    } else {
                        locationBasedQty = parseFloat(currentItemQty);
                        // locationBasedPackSizeAmount = parseFloat(currentPackSizeAmount);
                    }

                    // New Item so set up next object to store ...
                    var tempObj = new Object();
                    tempObj.item_internalid = itemResultSet[i].getValue({name: 'internalid'});
                    //tempObj.quantity = itemResultSet[i].getValue("formulanumeric")||0;
                    tempObj.quantity = locationBasedQty;


                    tempObj.item_name = itemResultSet[i].getValue({name: 'itemid'});
                    tempObj.mpn = itemResultSet[i].getValue({name: 'mpn'});
                    tempObj.item_prefsupplierid = itemResultSet[i].getValue({name: 'internalid', join: 'vendor'});
                    tempObj.item_prefsupplier = itemResultSet[i].getValue({name: 'entityid', join: 'vendor'});
                    tempObj.item_availcredit = itemResultSet[i].getValue({name: 'creditlimit', join:'vendor'});
                    tempObj.item_mov = itemResultSet[i].getValue({name: 'custentity_bb1_minimum_order_value', join:'vendor'});
                    if (!tempObj.item_mov || isNaN(tempObj.item_mov) || tempObj.item_mov.toString() == '.00')
                        tempObj.item_mov == 0.00;
                    tempObj.item_cp = itemResultSet[i].getValue({name: 'custentity_bb1_carriage_paid', join:'vendor'});
                    if (!tempObj.item_cp || isNaN(tempObj.item_cp) || tempObj.item_cp.toString() == '.00')
                        tempObj.item_cp == 0.00;
                    tempObj.item_baseprice = itemResultSet[i].getValue({name: 'baseprice'});
                    tempObj.item_supplierprice = itemResultSet[i].getValue({name: 'vendorcost'});
                    tempObj.item_isavailable = itemResultSet[i].getValue({name: 'isavailable'});
                    tempObj.item_availablestatus = itemResultSet[i].getValue({name: 'custitem_bb1_item_status'});
                    tempObj.item_acceptsbackorders = itemResultSet[i].getValue({name: 'custentity_holds_backorders', join:'vendor'});
                    if (tempObj.item_acceptsbackorders == true) {tempObj.item_acceptsbackorders  = 'Y'}
                    // Pack size (reorder multiple) calculations added to work out order qty ...
                    tempObj.packsize = itemResultSet[i].getValue({name: 'reordermultiple'});
                    if (tempObj.packsize == "" || !tempObj.packsize || isNaN(tempObj.packsize))
                        tempObj.packsize = 1;


                    tempObj.item_lastmodifieddate = itemResultSet[i].getValue({name: 'lastmodifieddate', join: 'vendor'});
                    tempObj.rate = itemResultSet[i].getValue({name: 'vendorcost'});
                    tempObj.desc = itemResultSet[i].getValue({name: 'displayname'});
                    tempObj.taxcode = itemResultSet[i].getValue({name: 'salestaxcode'});
                    tempObj.moq = itemResultSet[i].getValue({name: 'custitem_min_order_quantity'});

                    if (tempObj.quantity < tempObj.moq)
                        tempObj.quantity = tempObj.moq;

                    tempObj.orderquantity = parseFloat(tempObj.quantity);

                    var modQty = tempObj.quantity % tempObj.packsize;
                    if (modQty > 0)
                        tempObj.orderquantity += (parseFloat(tempObj.packsize) - modQty);



// change to calculating rather than using SS result, which was not Location aware
                    //tempObj.amountpacksize = locationBasedPackSizeAmount;


                    tempObj.amountpacksize = tempObj.orderquantity * tempObj.item_supplierprice;

                    if (i == itemResultSet.length-1) {
                        itemSearchResults.push(tempObj);
                    } else {
                        var nextID = itemResultSet[i+1].getValue({name: 'internalid'});
                        if (nextID != currentItemID)
                            itemSearchResults.push(tempObj);
                    }
                    prevItemID = currentItemID;

                    if (tempObj.item_prefsupplierid !== prevSupplierID){
                        supplier.addSelectOption({
                            value: tempObj.item_prefsupplierid,
                            text: tempObj.item_prefsupplier
                        });

                        supplierList.push(tempObj.item_prefsupplierid);

                        if(supplierValue !=='' && supplierValue == tempObj.item_prefsupplierid)
                            supplier.defaultValue = supplierValue;

                        supplierCount++;
                    }
                    prevSupplierID = tempObj.item_prefsupplierid;

                }

                if (supplierCount > 1)
                    itemList.label = supplierCount + ' Suppliers requiring POs'

                prevSupplierID = 0;
                var supplierPOList =[];
                var thisPOdate = '';
                var lastPOdate = '';
                var POdate = '';
                var POlink = '';

                if (supplierList.length >0){

                    // Check for pending approval POs ...
                    var poSupplierSearch = search.load({
                        id: 'customsearch_bb1_po_place_purchase_order'
                    });

                    defaultFilters = poSupplierSearch.filters;
                    defaultFilters.push(search.createFilter({
                        name: 'entity',
                        operator: search.Operator.ANYOF,
                        values: supplierList
                    }));

                    poSupplierSearch.filters = defaultFilters;
                    poSupplierSearch.run().each( function(srchResult) {

                        thisSupplierID = srchResult.getValue({ name: 'internalid', join: 'vendor' });

                        if (thisSupplierID != prevSupplierID && prevSupplierID != 0){
                            var objSupplierPO = new Object();
                            objSupplierPO.id = prevSupplierID;
                            objSupplierPO.lastdate = POdate;
                            objSupplierPO.link = POlink;

                            supplierPOList.push(objSupplierPO);

                            thisPOdate = '';
                            lastPOdate = '';
                            POdate = '';
                            POlink = '';
                        }

                        thisPOdate = srchResult.getValue({ name: 'custbody_date_approved' })||'';
                        if(thisPOdate !== ''){
                            if( lastPOdate < thisPOdate)
                                POdate = thisPOdate;
                        }
                        lastPOdate = thisPOdate;

                        if (srchResult.getValue({ name: 'approvalstatus' }) === '1'){
                            var poId= srchResult.getValue({ name: 'internalid' });
                            var poname= srchResult.getValue({ name: 'tranid' });
                            var poLink = '<a target=_blank href=/app/accounting/transactions/purchord.nl?id='+poId+'>'+poname+'</a>';

                            if ((POlink + ' ' + poLink).length > 300) return true; //Too many for field - skip any remaining ones

                            if (POlink ==='')
                                POlink = poLink;
                            else
                                POlink = POlink + ' ' + poLink;
                        }

                        prevSupplierID = thisSupplierID;
                        return true;    // continue iteration
                    });

                    var objSupplierPO = new Object();
                    objSupplierPO.id = prevSupplierID;
                    objSupplierPO.lastdate = POdate.replace(/\s.*/,'');;
                    objSupplierPO.link = POlink;

                    supplierPOList.push(objSupplierPO);
                    log.debug('supplierPOList[] : ' + supplierPOList.length, JSON.stringify(supplierPOList));

                    prevSupplierID = 0;
                    var supplierLastPOList =[];
                    var lastPOID = '';
                    var lastPOdate = '';
                    var lastPOlink = '';

                    // Check for last approved PO date for each supplier ...
                    var lastPOSupplierSearch = search.load({
                        id: 'customsearch_bb1_pz_last_purchase_ord'
                    });

                    defaultFilters = lastPOSupplierSearch.filters;
                    defaultFilters.push(search.createFilter({
                        name: 'entity',
                        operator: search.Operator.ANYOF,
                        values: supplierList
                    }));

                    lastPOSupplierSearch.filters = defaultFilters;
                    lastPOSupplierSearch.run().each( function(srchResult) {

                        lastPOID = srchResult.getValue({ name: 'internalid', join: null, summary: search.Summary.MAX }) || '';
                        lastPOdate = srchResult.getValue({ name: 'custbody_date_approved', join: null, summary: search.Summary.MAX }) || '';
                        if (lastPOdate && lastPOdate !== '')
                            lastPOdate = lastPOdate.replace(/\s.*/,'');

                        lastPOlink = '<a target=_blank href=/app/accounting/transactions/purchord.nl?id='+lastPOID+'>'+lastPOdate+'</a>';

                        var objSupplierlastPO = new Object();
                        objSupplierlastPO.id = srchResult.getValue({ name: 'internalid', join: 'vendor', summary: search.Summary.GROUP });
                        objSupplierlastPO.lastdate = lastPOdate;
                        objSupplierlastPO.link = lastPOlink;

                        supplierLastPOList.push(objSupplierlastPO);

                        return true;    // continue iteration
                    });

                    log.debug('supplierLastPOList[] : ' + supplierLastPOList.length, JSON.stringify(supplierLastPOList));
                }

                var ignorePendingSupplierIDs = ignoreSupplierIDs(supplierList);

                // ****** SET SUBLIST VALUES HERE ******
                var supplierIdCheck='';
                var checkPoStatus='Approved';
                var sublistLineID= 0;
                var sublierId='';
                //var unapprovedPoId='';
                var totalValue=0;

                var itemStatus= 'Available';
                var statusList = [7,6,5,8,9,10,4];
                var statusNames = []
                for (var s=0; s<statusList.length; s++){
                    var statusRec = search.lookupFields({
                        type: "customlist_bb1_item_status",
                        id: statusList[s],
                        columns: ['internalid', 'name']
                    });
                    var objStatus = new Object();
                    objStatus.id = statusList[s];
                    objStatus.name =  statusRec['name'];
                    statusNames.push(objStatus);
                }
                log.debug("statusNames[] : ", JSON.stringify(statusNames));

                for (var i in itemSearchResults)
                {
                    var unapprovedPoId='';
                    var lastPoApprovedDate='';
                    var checkPrevPoApprovedDate = '';
                    var poDate='';
                    var supplierItemList = {}

                    if((supplierIdCheck ==='')|| (supplierIdCheck !== itemSearchResults[i].item_prefsupplierid)){
                        listItems = [];
                        supplierItemList = {}
                        totalValue=0;
                        var checkSupplierForQuantity ='';
                        var u = i;
                        for (u in itemSearchResults){
                            checkSupplierForQuantity =itemSearchResults[u].item_prefsupplierid;
                            if((checkSupplierForQuantity === itemSearchResults[i].item_prefsupplierid)){
                                if((itemSearchResults[u].quantity||0) > 0){
                                    totalValue= parseFloat(totalValue) + (parseFloat(itemSearchResults[u].item_supplierprice||0) * parseFloat(itemSearchResults[u].orderquantity||0));
                                    var itemJson = new Object();
                                    itemJson.item= itemSearchResults[u].item_internalid;
                                    itemJson.qty = itemSearchResults[u].orderquantity||0;
                                    itemJson.rate = itemSearchResults[u].item_supplierprice;
                                    itemJson.mpn = itemSearchResults[u].mpn;
                                    itemJson.desc = itemSearchResults[u].desc;
                                    itemJson.status = itemSearchResults[u].item_availablestatus;
                                    itemJson.taxcode = itemSearchResults[u].taxcode;
                                    listItems.push(itemJson);
                                }
                            }
                        }



                        // Excludes any POs pending creation suppliers in the scheduled queue ...
                        sublierId = itemSearchResults[i].item_prefsupplierid;
                        var doSupplier = true;
                        for (var j = 0; j < ignorePendingSupplierIDs.length; j++){
                            if (sublierId === ignorePendingSupplierIDs[j])
                                doSupplier = false;
                        }

                        if(totalValue !== 0 && doSupplier){

                            // Check for any pending approval POs for this supplier
                            for (var sp=0; sp<supplierPOList.length; sp++){
                                if (supplierPOList[sp].id === sublierId){
                                    poDate = supplierPOList[sp].lastdate;
                                    unapprovedPoId = supplierPOList[sp].link;
                                }
                            }
                            // Check for last PO date for this supplier (if none pending)
                            //if (poDate == ''){
                            for (var sd=0; sd<supplierLastPOList.length; sd++){
                                if (supplierLastPOList[sd].id === sublierId){
                                    poDate = supplierLastPOList[sd].link;
                                    break;
                                }
                            }
                            //}

                            var sublist = form.getSublist({
                                id : 'custpage_itemsublist'
                            });

                            sublist.setSublistValue({
                                id : 'custpage_list_value',
                                line :sublistLineID,
                                value : totalValue.toFixed(2)
                            });

                            sublist.setSublistValue({
                                id : 'custpage_list_qty',
                                line :sublistLineID,
                                value : itemSearchResults[i].orderquantity||0
                            });

                            var JSONitemsString = JSON.stringify(listItems);
                            log.debug('JSON.stringify(listItems) : ' + JSONitemsString.length,JSONitemsString);
                            //JSONitemsString = JSONitemsString.slice(0,3999);
                            if (JSONitemsString.length >= 4000){
                                var bigPOfield = "custpage_bigpo_" + sublierId;
                                var supplierbigdata = form.addField({
                                    id: bigPOfield,
                                    type: serverWidget.FieldType.LONGTEXT,
                                    label: 'Big PO Supplier ID :' + sublierId
                                });
                                log.debug('Big PO Supplier ID :' + sublierId,"custpage_bigpo_" + sublierId);
                                supplierbigdata.defaultValue = JSONitemsString;

                                supplierbigdata.updateDisplayType({
                                    displayType: serverWidget.FieldDisplayType.HIDDEN
                                });

                                sublist.setSublistValue({
                                    id : 'custpage_json',
                                    line :sublistLineID,
                                    value : bigPOfield
                                });

                            } else {
                                sublist.setSublistValue({
                                    id : 'custpage_json',
                                    line :sublistLineID,
                                    value : JSONitemsString
                                });
                            }

                            var hashCode = JSONitemsString.hashCode();
                            log.debug('Hash - sublistLineID : ' + sublistLineID, hashCode);
                            sublist.setSublistValue({
                                id : 'custpage_hash',
                                line :sublistLineID,
                                value : hashCode
                            });

                            runtime.getCurrentSession().set({
                                name: 'json',
                                value: JSONitemsString
                            });

                            runtime.getCurrentSession().set({
                                name: 'checkbox',
                                value: ''
                            });

                            sublist.setSublistValue({
                                id : 'custpage_list_availcredit',
                                line : sublistLineID,
                                value : itemSearchResults[i].item_availcredit||0
                            });
                            sublist.setSublistValue({
                                id : 'custpage_list_acceptsbackorders',
                                line : sublistLineID,
                                value : itemSearchResults[i].item_acceptsbackorders||' '
                            });


                            var itemMOV = (itemSearchResults[i].item_mov && !isNaN(itemSearchResults[i].item_mov)) ? itemSearchResults[i].item_mov : 0.0;
                            sublist.setSublistValue({
                                id : 'custpage_list_mov',
                                line : sublistLineID,
                                value : itemMOV
                            });

                            //worst case scenario by PO. Result display order is (worst first):  1. Unable To Source, then 2.Out Of Stock - Uncertain Date, then 3.OOS - Set Date, then 4. To Be Discontinued, then 5. New.
                            //Then finally, if appropriate 6. Available. PO status should only be GTG if all items are status Available.
                            //So system should cycle through all skus on an order. If it finds any all that are Unable to Source, that is the label needed. If it canï¿½t find any of these, then it should look for Out Of Stock ï¿½ Uncertain Date and give the line that status etc. until finally, if there are no issues, the status becomes Available.

                            //if(itemSearchResults[z].item_isavailable === true)
                            var setStatus = 0;
                            var statusName = "";
                            itemStatus= 'Available';
                            for (var st=0; st<statusNames.length && statusName == ""; st++) {
                                for (var z in listItems) {
                                    //log.debug(z + '   listItems[z].status : ' + listItems[z].status + "    statusNames[st].id.value: " + statusNames[st].id);
                                    if (listItems[z].status*1 === statusNames[st].id*1){
                                        setStatus = statusNames[st].id;
                                        statusName = statusNames[st].name;
                                        itemStatus = statusName;
                                        break;
                                    } // id 4 == available
                                }
                            }
                            log.debug('item_availablestatus : ' + setStatus + " : " + statusName); // Use custom item field not standard one

                            sublist.setSublistValue({
                                id : 'custpage_list_status',
                                line : sublistLineID,
                                value :itemStatus
                            });

                            if(poDate !==''){
                                //poDate = poDate.split(' ')[0];
                                sublist.setSublistValue({
                                    id : 'custpage_list_lastpodate',
                                    line : sublistLineID,
                                    value :poDate
                                });
                            }

                            if(unapprovedPoId !==''){
                                sublist.setSublistValue({
                                    id : 'custpage_list_postoapprove',
                                    line : sublistLineID,
                                    value :unapprovedPoId
                                });

                                sublist.setSublistValue({
                                    id : 'custpage_list_pendingpo_hidden',
                                    line : sublistLineID,
                                    value :unapprovedPoId
                                });

                                log.debug('unapprovedPoId', unapprovedPoId);

                            }
                            else{
                                var createPoLink = '<div' + ' onclick="nlapiSetFieldValue(\'custpage_clicksupplier\',\'' + sublierId + '\');"'+ ' style="text-decoration: underline;cursor: pointer;" title="Click to create and edit a PO pending approval ...">Create PO</div>';
                                //var createPoLink = '<div' + ' onclick="nlapiSetFieldValue(\'custpage_clicksupplier\',\'' + sublierId + '\');document.getElementById(\'createordersforapproval\').click();"'+ ' style="text-decoration: underline;cursor: pointer;">Create PO</div>';

                                sublist.setSublistValue({
                                    id : 'custpage_list_postoapprove',
                                    line : sublistLineID,
                                    value :createPoLink
                                });

                            }

                            var supplierName = itemSearchResults[i].item_prefsupplier;
                            var supplierID = itemSearchResults[i].item_prefsupplierid;
                            var MOV = (itemSearchResults[i].item_mov && !isNaN(itemSearchResults[i].item_mov*1.00)) ? parseFloat(itemSearchResults[i].item_mov*1.00) : 0.00;
                            var CP = (itemSearchResults[i].item_cp && !isNaN(itemSearchResults[i].item_cp*1.00)) ? parseFloat(itemSearchResults[i].item_cp*1.00) : 0.00;
                            var supplierLink = '<a target=_blank href=/app/common/entity/vendor.nl?id='+supplierID+'>'+supplierName+'</a>';

                            log.debug('supplierName : ' + supplierName,' MOV : ' + MOV + " CP : " + CP + " totalValue : " + totalValue + " unapprovedPoId : " + unapprovedPoId + " itemStatus : " + itemStatus );

                            if(((MOV) <= (parseFloat(totalValue))) && ((CP) <= (parseFloat(totalValue))) && (unapprovedPoId ==='') && (itemStatus === 'Available'))
                            {
                                // Sandbox link ...
                                //var imgPath = "https://4970829-sb1.app.netsuite.com/core/media/media.nl?id=1758&c=4970829_SB1&h=8398ab3d54521d99086f"

                                //Production link ...
                                var imgPath = "https://4970829.app.netsuite.com/core/media/media.nl?id=1758&c=4970829&h=d755337f466e9b23f40b"; // Use the url in file cabinet

                                var imageUrl = '<img src="'+imgPath+'"/>';

                                sublist.setSublistValue({
                                    id : 'custpage_list_goodtogo',
                                    line : sublistLineID,
                                    value : imageUrl //link //imageUrl
                                });

                            }

                            sublist.setSublistValue({
                                id : 'custpage_list_carriagepaid',
                                line : sublistLineID,
                                value : CP
                            });


                            var supplierId = itemSearchResults[i].item_prefsupplierid;
                            runtime.getCurrentSession().set({
                                name: 'supplierId',
                                value: supplierId
                            });

                            sublist.setSublistValue({
                                id : 'custpage_list_supplierid',
                                line :sublistLineID,
                                value : supplierId
                            });

                            sublist.setSublistValue({
                                id : 'custpage_list_supplier',
                                line :sublistLineID,
                                value : supplierLink
                            });

                            if((parseFloat(totalValue)) < (CP))
                            {
                                sublist.setSublistValue({
                                    id : 'custpage_list_mincarriagepaid',
                                    line : sublistLineID,
                                    value : 'N'
                                });
                            }
                            else{
                                sublist.setSublistValue({
                                    id : 'custpage_list_mincarriagepaid',
                                    line : sublistLineID,
                                    value : 'Y'
                                });
                            }
                            sublistLineID = sublistLineID + 1;
                            supplierIdCheck = itemSearchResults[i].item_prefsupplierid;
                        }
                    }
                }
            }
        }

        function ignoreSupplierIDs(theSupplierIDs){

            if (!theSupplierIDs || theSupplierIDs === "" || theSupplierIDs.length==0) return [];

            var JSONsearch = search.create({
                type: 'customrecord_bb1_oi_json_supplier_data',
                columns:[
                    search.createColumn({
                        name: 'custrecord_bb1_oi_supplier_lookup'
                    })],
                filters: [
                    search.createFilter({
                        name: 'custrecord_bb1_oi_supplier_lookup',
                        operator: search.Operator.ANYOF,
                        values: theSupplierIDs
                    }),
                    search.createFilter({
                        name: 'custrecord_bb1_status',
                        operator: search.Operator.ANYOF,
                        values: [1,2]
                    })
                ]
            });

            var theSupplierIDs = [];
            JSONsearch.run().each( function(srchResult) {
                theSupplierIDs.push(srchResult.getValue({ name: 'custrecord_bb1_oi_supplier_lookup'}));
                return true;    // continue iteration
            });
            log.debug("ignoreSupplierIDs : " + theSupplierIDs.join(","));

            return theSupplierIDs;

        }

        return {
            onRequest: onRequest
        };

    });