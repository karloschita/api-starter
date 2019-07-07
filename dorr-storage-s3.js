/*******************************************************
 * service: api-starter kit
 * module: simple storage (via s3)
 * required: ~/.aws/crdentials
 * Mike Amundsen (@mamund)
 *******************************************************/

/*
 * DORR DATA Module
 - simple storage component reads/writes objects in s3
 - FOLDER is the s3 bucket extension (tasks, users, notes, etc.)
 - FILE is the record (stored as JSON object, w/ ID)
 - CRUD style interface (list, item, add, update, remove)
 - "contains"-type filtering is supported, no sort or join
 - NOTE: all actions are *synchronous* 
*/

var AWS = require('aws-sdk');
var s3 = new AWS.S3();

// unique identifier for S3 bucket for this project
var folder = 'cc7b434e-8fc3-4f74-9dc4-3ec4400b8e19';

module.exports = main;

/*
 * args is a hash table of possible arguments
 * {object:"",action:"",filter:"",id:"",item:objItem}
 */
function main(args) {
  var rtn;

  // resolve arguments
  var action = args.action||"";
  var object = args.object||null;
  var filter = args.filter||null;
  var id = args.id||null;
  var item = args.item||{};

  switch (action) {
    case 'create':
      rtn = createObject(object);
      break;
    case 'list':
      rtn = getList(object);
      break;
    case 'filter':
      rtn = getList(object, filter);
      break;
    case 'item':
      rtn = getItem(object, id);
      break;
    case 'add':
      rtn = addItem(object, item, id);
      break;
    case 'update':
      rtn = updateItem(object, item, id);
      break;
    case 'remove':
      rtn = removeItem(object, id);
      break;
    default:
      rtn = null;
      break;
  }
  return rtn;
}

// get a list of items (possibly via filter)
function getList(object, filter) {
  var coll, item, list, i, x, t, name;

  coll = [];
  try {
    list = s3ObjectList(folder+'-'+ object);
    for (i = 0, x = list.length; i < x; i++) {
      item = s3ObjectRead(folder+'-'+object, list[i].Key);
      if (filter && filter!==null) {
        t = null;
        for (var name in filter) {
          if(filter[name].toString().length!==0) {
            try {
              if (item[name].toString().toLowerCase().indexOf(filter[name].toString().toLowerCase()) !== -1) { 
                t = list[i];
              } else {
                t = null;
              }
            } catch (err) {
              t = null;
            }
          }
        }
        if (t !== null) {
          coll.push(item);
        }
      } else {
        coll.push(item);
      }
    }
  } catch (ex) {
    coll = [];
  }

  return coll;
}

// retrieve and existing item
function getItem(object, id) {
  var rtn;

  try {
    rtn = s3ObjectRead(folder+'-'+ object,id);
  } catch (ex) {
    rtn = exception("SimpleStorage: ["+object+"]", ex.message, 400);
  }

  return rtn;
}

// create a storage object (folder)
function createObject(object) {
  try {
    if(folder && folder !==null) {
      if(!s3BucketExists(folder+'-'+object)) {
        s3BucketCreate(folder+'-'+object);
      }
    }
  } catch(ex) {
    rtn = exception("S3Storage: ["+object+"]", ex.message, 400);
  }
}

// add a new item
function addItem(object, item, id) {
  var rtn;

  if (id) {
    item.id = id;
  } else {
    item.id = makeId();
  }
  item.dateCreated = new Date();
  item.dateUpdated = item.dateCreated;

  if (s3ObjectExists(folder+'-'+object,item.id)) {
    rtn = exception("SimpleStorage: ["+object+"]", "Record already exists");
  } else {
    try {
      s3ObjectWrite(folder+'-'+object, item.id, JSON.stringify(item));
      rtn = getItem(object, item.id);
    } catch (ex) {
      rtn = exeption("SimpleStorage: ["+object+"]", ex.message, 400);
    }
  }
  return rtn;
}

// modify an existing item
function updateItem(object, item, id) {
  var current, rtn;

  current = getItem(object, id);
  if (!current) {
    rtn = exception("SimpleStorage: ["+object+"]", "Invalid [id]", 400);
    return rtn;
  }
   
  current = item;
  current.dateUpdated = new Date();
  
  rtn = null;
  try {
    s3ObjectWrite(folder+'-'+object, id, JSON.stringify(current));
    rtn = getItem(object, id);
  } catch (ex) {
    rtn = exception("SimpleStorage: ["+object+"]", ex.message,400);
  }

  return rtn;
}

// remove the item
function removeItem(object, id) {
  var rtn;

  try {
    s3ObjectDelete(folder+'-'+object, id);
    rtn = getList(object);
  } catch (ex) {
    rtn = getList(object);
  }
  return rtn;
}

// generate a unique id 
function makeId() {
  var rtn;

  rtn = String(Math.random());
  rtn = rtn.substring(2);
  rtn = parseInt(rtn).toString(36);

  return rtn;
}

// craft an exception msg
function exception(name, message, code, type, url) {
  var rtn = {};

  rtn.type = (type||"error");
  rtn.title = (name||"Error");
  rtn.detail = (message||rtn.name);
  rtn.status = (code||400);
  if(url) {rtn.instance = url};

  return rtn;
}

// S3 support routines

function s3BucketExists(bucket) {
  var rt = false;
  var params = {};
  params.Bucket = bucket;
  
  s3.headBucket(params, function(err,data) {
    if(err) {
      rt = false;
    }
    else {
      rt = true;
    }
    return rt;
  });
}

function s3BucketCreate(bucket) {
  rt = "";
  var params = {};
  params.Bucket = bucket;
  
  s3.createBucket(params, function(err,data) {
    if(err) {
     rt = false;
    }
    else {
      rt = true;
    }
    return rt;
  });
};

function s3ObjectList(bucket) {
  rt = [];
  var params = {};
  params.Bucket = bucket;

  s3.listObjects(params, function(err, data) {
    if(err) {
      rt = [];
    }
    else {
      rt = data.Contents;
    }
    return rt;
  });
}

function s3ObjectRead(bucket, key) {
  var rt = {};
  var params = {};
  params.Bucket = bucket;
  params.Key = key;

  s3.getObject(params, function(err,data) {
    if(err) {
      rt = {};
    }
    else {
      rt = data.Body.toString('utf-8');
    }
    return rt;
  });
}

function s3ObjectExists(bucket, key) {
  var rt = false;
  var params = {};
  params.Bucekt = bucket;
  params.Key = key;

  s3.headObject(params, function(err, data) {
    if(err) {
      rt = false;
    }
    else {
      rt = true;
    }
    return rt;
  });
}

function s3ObjectWrite(bucket, key, body) {
  var rt = false;
  var parsm = {};
  params.Bucket = bucket;
  params.Key = key;
  params.Body = body;

  s3.putObject(params, function(err,data) {
    if(err) {
      rt = false;
    } 
    else {
      rt = true;
    }
    return rt;
  });
}

function s3ObjectDelete(bucket, key) {
  var rt = false;
  var params = {};
  params.Bucket = bucket;
  params.Key = key;

  s3.deleteObject(params, function(err, data) {
    if(err) {
      rt = false;
    }
    else {
      rt = true;
    }
    return rt;
  });
}

// generic response
function s3Response(err,data) {
  if(err) {
    if(err.statusCode) {
      console.log(err.statusCode);
    }
    else {
      console.log(err);
    }
  }
  else {
    if(data.Body) {
      console.log(data.Body.toString('utf-8'));
    }
    else {
      console.log(data);
    }
  }
}


// EOF

