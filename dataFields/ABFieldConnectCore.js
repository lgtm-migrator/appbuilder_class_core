/*
 * ABFieldConnect
 *
 * An ABFieldConnect defines a connect to other object field type.
 *
 */

var ABFieldSelectivity = require("../../platform/dataFields/ABFieldSelectivity");

function L(key, altText) {
   // TODO:
   return altText; // AD.lang.label.getLabel(key) || altText;
}

var ABFieldConnectDefaults = {
   key: "connectObject", // unique key to reference this specific DataField

   icon: "external-link", // font-awesome icon reference.  (without the 'fa-').  so 'user'  to reference 'fa-user'

   // menuName: what gets displayed in the Editor drop list
   menuName: L(
      "ab.dataField.connectObject.menuName",
      "*Connect to another record"
   ),

   // description: what gets displayed in the Editor description.
   description: L(
      "ab.dataField.connectObject.description",
      "*Connect two data objects together"
   ),

   isSortable: false,
   isFilterable: true, // now we can filter using Queries
   useAsLabel: false,

   supportRequire: false
};

var defaultValues = {
   linkObject: "", // ABObject.id
   // the .id of the ABObject we are connected to

   linkType: "one", // [one, many]
   // 'one' : this object can have only 1 of our linkObject
   // 'many': this object can have MANY of our linkObject

   linkViaType: "many", // [one, many]
   // 'one' : the linkedObject can only have 1 of me
   // 'many' : the linkedObject can have many of me

   linkColumn: "", // ABField.id
   // the .id of the field in the linkedObject that is our
   // connected field.

   isSource: null, // bit : 1,0
   // isSource indicates that this object is the source of the connection:
   // if linkType==one, and isSource=1, then the value in this object's field
   // 		is the connected object's id
   // if linkType == one, and isSource = 0, then the linkObject has this obj.id
   //  	in it's connected field (linkColumn)

   isCustomFK: 0,
   indexField: "", // ABField.id
   indexField2: "" // ABField.id
};

module.exports = class ABFieldConnectCore extends ABFieldSelectivity {
   constructor(values, object) {
      super(values, object, ABFieldConnectDefaults);

      // text to Int:
      this.settings.isSource = parseInt(this.settings.isSource || 0);
      this.settings.isCustomFK = parseInt(this.settings.isCustomFK || 0);
   }

   // return the default values for this DataField
   static defaults() {
      return ABFieldConnectDefaults;
   }

   static defaultValues() {
      return defaultValues;
   }

   ///
   /// Instance Methods
   ///

   fromValues(values) {
      super.fromValues(values);

      // text to Int:
      this.settings.isSource = parseInt(this.settings.isSource || 0);
      this.settings.isCustomFK = parseInt(this.settings.isCustomFK || 0);
   }

   ///
   /// Working with Actual Object Values:
   ///

   /**
    * @method defaultValue
    * insert a key=>value pair that represent the default value
    * for this field.
    * @param {obj} values a key=>value hash of the current values.
    */
   defaultValue(values) {}

   /**
    * @method isValidData
    * Parse through the given data and return an error if this field's
    * data seems invalid.
    * @param {obj} data  a key=>value hash of the inputs to parse.
    * @param {OPValidator} validator  provided Validator fn
    * @return {array}
    */
   isValidData(data, validator) {
      super.isValidData(data, validator);
   }

   relationName() {
      // there is object name - {objectName}.{columnName}
      if (this.columnName.indexOf(".") > -1) {
         let names = this.columnName.split(".");

         return (
            names[0] +
            "." +
            (String(names[1]).replace(/[^a-z0-9\.]/gi, "") + "__relation")
         );
      } else {
         let relationName =
            String(this.columnName).replace(/[^a-z0-9\.]/gi, "") + "__relation";

         return relationName;
      }
   }

   /**
    * @method datasourceLink
    * return the ABObject that this field connection links to
    * @return {ABObject}
    */
   get datasourceLink() {
      return this.object.application.objects(
         (obj) => obj.id == this.settings.linkObject
      )[0];
   }

   /**
    * @method fieldLink
    * return the ABField that we are linked to.
    * @return {ABDataField}  or undefined if not found.
    */
   get fieldLink() {
      var objectLink = this.datasourceLink;
      if (!objectLink) return null;

      return objectLink.fields((f) => f.id == this.settings.linkColumn)[0];
   }

   /**
    * @method pullRelationValues
    *
    *
    * @param {*} row
    *
    * @return {array}
    */
   pullRelationValues(row) {
      var selectedData = [];

      // Get linked object
      var linkedObject = this.datasourceLink;

      var data = this.dataValue(row);
      if (data && linkedObject) {
         // convert to JSON
         if (typeof data == "string") {
            try {
               data = JSON.parse(data);
            } catch (e) {}
         }

         // if this select value is array
         if (data.map) {
            selectedData = data.map(function(d) {
               // display label in format
               if (d) d.text = d.text || linkedObject.displayData(d);

               return d;
            });
         } else if (data.id) {
            selectedData = data;
            selectedData.text =
               selectedData.text || linkedObject.displayData(selectedData);
         }
      }

      return selectedData;
   }

   dataValue(rowData) {
      let propName = "{objectName}.{relationName}"
         .replace("{objectName}", this.object.name)
         .replace("{relationName}", this.relationName());

      return (
         rowData[this.relationName()] ||
         rowData[propName] ||
         rowData[this.columnName] ||
         ""
      );
   }

   format(rowData) {
      var val = this.pullRelationValues(rowData);

      // array
      if (Array.isArray(val)) return val.map((v) => v.text).join(", ");
      // string
      else if (val && val.text) return val.text;
      // empty string
      else return "";
   }

   /**
    * @method linkType
    * return the type of connection we have to our connected object
    * @return {string}
    */
   linkType() {
      return this.settings.linkType;
   }

   /**
    * @method linkType
    * return the type of connection we have to our connected object
    * @return {string}
    */
   linkViaType() {
      return this.settings.linkViaType;
   }

   /**
    * @method isSource
    * does this object contain the .id of the remote object (in case of linkType : one )
    * @return {bool}
    */
   isSource() {
      return this.settings.isSource;
   }

   /**
    * @property indexField
    * @return {ABField}
    */
   get indexField() {
      if (!this.settings.isCustomFK || !this.settings.indexField) {
         return null;
      }

      // 1:M
      if (
         this.settings.linkType == "one" &&
         this.settings.linkViaType == "many"
      ) {
         return this.datasourceLink.fields(
            (f) => f.id == this.settings.indexField
         )[0];
      }
      // 1:1
      else if (
         this.settings.linkType == "one" &&
         this.settings.linkViaType == "one"
      ) {
         if (this.settings.isSource) {
            return this.datasourceLink.fields(
               (f) => f.id == this.settings.indexField
            )[0];
         } else {
            return this.object.fields(
               (f) => f.id == this.settings.indexField
            )[0];
         }
      }
      // M:1
      else if (
         this.settings.linkType == "many" &&
         this.settings.linkViaType == "one"
      ) {
         return this.object.fields((f) => f.id == this.settings.indexField)[0];
      }
      // M:N
      else if (
         this.settings.linkType == "many" &&
         this.settings.linkViaType == "many"
      ) {
         let indexField = this.object.fields(
            (f) => f.id == this.settings.indexField
         )[0];

         if (indexField == null)
            indexField = this.datasourceLink.fields(
               (f) => f.id == this.settings.indexField
            )[0];

         return indexField;
      }

      return null;
   }

   /**
    * @property indexField2
    * @return {ABField}
    */
   get indexField2() {
      if (!this.settings.isCustomFK || !this.settings.indexField2) {
         return null;
      }

      let indexField;

      // M:N only
      if (
         this.settings.linkType == "many" &&
         this.settings.linkViaType == "many"
      ) {
         indexField = this.object.fields(
            (f) => f.id == this.settings.indexField2
         )[0];

         if (indexField == null)
            indexField = this.datasourceLink.fields(
               (f) => f.id == this.settings.indexField2
            )[0];
      }

      return indexField;
   }
};
