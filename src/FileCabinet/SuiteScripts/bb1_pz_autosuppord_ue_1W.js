/**
 * Version    Date            Author           Remarks
 * 1.00       23 Apr 2019     Vijayata Sumra   Initial release
 * 2.00       22 Mar 2020     Leigh Darby	   Changes for 1W upgrade / tax schedules replacing tax codes
 * 3.00		  16 Nov 2022     Stuart Anderton  Background creation of POs.
 * 
 *
 * Copyright (c) 2019 BlueBridge One Business Solutions, All Rights Reserved
 * support@bluebridgeone.com, +44 (0)1932 300007
 * 
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
define(['N/record','N/search', 'N/redirect'],

		function(record,search, redirect) {

	function beforeLoad(context) {
		if (context.type !== context.UserEventType.CREATE)
			return;

		//var rqParams = null;
		// other scripts and processes can still trigger this in such a way that context.request passes the tests above,
		// but context.request.parameters throws: Cannot call method "getAllParameters" of undefined
		// so bail out if parameters cannot be retrieved!
		try { rqParams = context.request.parameters; } catch (E) { return; }

		var request = context.request;
		var openpo= request.parameters.openpo||'';
		log.debug('openpo',openpo);
		if(openpo !== 'openpo')
			return;
		var entity = request.parameters.entity||'';
		log.debug('entity', entity);
		var customrecord = request.parameters.customrecord||'';//'[{"item":"17847", "qty":"7"},{"item":"6067", "qty":"1"}]'
		var fieldLookUp = search.lookupFields({
			type: 'customrecord_bb1_oi_json_supplier_data',
			id: customrecord,
			columns: ['custrecord_bb1_oi_po_json_data']
		});

		var json= fieldLookUp.custrecord_bb1_oi_po_json_data;

		log.debug('json', json);
		var currentRecord = context.newRecord;

		currentRecord.setValue({
			fieldId: 'custbody_bb1_pz_newpo_json_data_id',
			value: customrecord,
			ignoreFieldChange: false
		});

		// SWA create PO here.

		var newPO = record.create({
			type: record.Type.PURCHASE_ORDER,
			isDynamic: false
		})

		newPO.setValue({
			fieldId: 'entity',
			value: entity
		})



		var i =0;

		var jsonData = JSON.parse(json);
		log.debug('jsonData.length',jsonData.length);
		for ( i = 0; i < jsonData.length; i++) {
			//log.debug('i',i);
			//var counter = jsonData[i];

			newPO.insertLine({
				sublistId: 'item',
				line: i
			});

			newPO.setSublistValue({
				sublistId: 'item',
				fieldId: 'item',
				value: jsonData[i].item.toString(),
				line: i
			});

			newPO.setSublistValue({
				sublistId: 'item',
				fieldId: 'quantity',
				value: jsonData[i].qty,
				line: i
			});

			newPO.setSublistValue({
				sublistId: 'item',
				fieldId: 'rate',
				value: jsonData[i].rate.toString(),
				line: i
			});



		}

		var newPOId = newPO.save()

		redirect.toRecord({
			type: record.Type.PURCHASE_ORDER,
			id: newPOId,
			isEditMode: true
		})


	}

	return {
		beforeLoad: beforeLoad
	};
});