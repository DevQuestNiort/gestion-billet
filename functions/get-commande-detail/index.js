const functions = require('@google-cloud/functions-framework');
const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();
const KIND = "Commande";
functions.http('getCommandDetails', async (req, res) => {
  
  const {commandId} = req.body;
  console.log(`Received a query on command ${commandId}`);

  const key = decodeKey(commandId, datastore);
  const [commandEntity] = await datastore.get(key);

  if (!commandEntity) {
    return res.status(404).json({error: "Command not found"});
  }
  console.log("Command has been found");
  return res.status(200).json(commandEntity);
});


function decodeKey(commandId, datastore) {
  try {
    return datastore.keyFromLegacyUrlsafe(commandId);
  } catch (error) {
    return datastore.keyFromLegacyUrlsafe(commandId);
  }
}