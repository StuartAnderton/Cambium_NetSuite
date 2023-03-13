


/**
 *@NApiVersion 2.x
 *@NScriptType MassUpdateScript
 */
define(['N/record', 'N/format'],
	function (record, format) {
	    function each(params)
{
    // Set tLast Notifiable Update
    var recToChange = record.load({
        type: params.type,
        id: params.id
    });

    //var newLNU = format.format({value: new Date(), type: format.Type.DATETIME});
    //log.debug('Logging', newLNU)
    recToChange.setValue('custitem_last_notifiable_update', new Date());
    recToChange.save();
}

	return {
		each: each
	};
});