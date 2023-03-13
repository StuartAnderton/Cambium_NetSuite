/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/runtime', 'N/task', 'N/file'],
    /**
     * @param{runtime} runtime
     * @param{task} task
     */
    (runtime, task, file) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {

            var scriptObj = runtime.getCurrentScript();
            var fileName = scriptObj.getParameter({name: 'custscript_filename'});
            var importId = scriptObj.getParameter({name: 'custscript_import_id'});
            var processedFolder = scriptObj.getParameter({name: 'custscript_processed'});

            log.debug('Parameters', [fileName, importId, processedFolder])
                var scriptTask = task.create({taskType: task.TaskType.CSV_IMPORT});
                scriptTask.mappingId = importId;
                var f = file.load({id: fileName});
                scriptTask.importFile = f;
                var csvImportTaskId = scriptTask.submit();
                log.audit('Load started', csvImportTaskId)
                if (processedFolder > 0) {
                    log.debug('Copying', [f.id, processedFolder])

                    var fileId = parseInt(f.id);


                    var copyFile = file.copy({
                        id: fileId,
                        folder: processedFolder,
                        conflictResolution: file.NameConflictResolution.RENAME_TO_UNIQUE
                    })

                    log.debug('Copied', copyFile.id)

                    do {
                        var status =  task.checkStatus({
                            taskId: csvImportTaskId
                        });
                        //log.debug('Waiting to start processing', [status.status, status.status == 'PENDING'])
                    } while (status.status == 'PENDING' )

                    log.debug('Deleting')

                    file.delete({
                        id: fileId
                    });

                    log.debug('Deleted')

                }

            log.debug('Done')
        }



        return {execute}

    });
