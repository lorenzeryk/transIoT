import { Injectable, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { DataService } from './data.service';
import { RawDataLayer } from './layer-types';
import Layer from '@arcgis/core/layers/Layer';
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer'
import SizeVariable from '@arcgis/core/renderers/visualVariables/SizeVariable'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import CIMSymbol from '@arcgis/core/symbols/CIMSymbol'
import { applyCIMSymbolColor } from '@arcgis/core/symbols/support/cimSymbolUtils'
import WebStyleSymbol from '@arcgis/core/symbols/WebStyleSymbol'
import Graphic from '@arcgis/core/Graphic';
import GeometryProperties from '@arcgis/core/geometry/Point';
import Color from "@arcgis/core/Color.js";
import { VehiclePositionPoint } from './query-builders/vehicle-position/vehicle-position-query.model';
import { ArcGISFeatureQuery } from './query/arcgis-query';
import { LayerType, Query, QueryType } from './query/query';

@Injectable({
  providedIn: 'root'
})
export class LayersService {
  private layers: Map<string, Layer> = new Map<string, Layer>(); // stores actual layers (referenced by esri-map)

  colors = [
    "#ff0000",
    "#00ff00",
    "#0000ff"
  ]
  colors_sequence = 0;

  /* *********************** */
  /*  Subject/Subscriptions  */
  /* *********************** */

  private addLayerToMap = new Subject<string>();
  public addLayerToMap$ = this.addLayerToMap.asObservable();
  private removeLayerFromMap = new Subject<string>();
  public removeLayerFromMap$ = this.removeLayerFromMap.asObservable();

  private addLayerToLayersView = new Subject<Query>();
  public addLayerToLayersView$ = this.addLayerToLayersView.asObservable();

  getLayer(id: string) {
    return this.layers.get(id);
  }

  /* *************** */
  /* Layer Modifiers */
  /* *************** */

  setInitialColor(query: Query) {
    query.color = this.colors[this.colors_sequence];
    this.colors_sequence = (this.colors_sequence + 1) % this.colors.length;
  }

  changeLayerColor(id: string, color: string) {
    var l = this.layers.get(id);
    if (l instanceof FeatureLayer) {
      const symbol = ((l as FeatureLayer).renderer as
        SimpleRenderer).symbol;
      if (symbol.type == "simple-marker") {
        (symbol as SimpleMarkerSymbol).color = new Color(color);
      } else if (symbol.type == "cim") {
        const cimSymbol = symbol as CIMSymbol;
        applyCIMSymbolColor(cimSymbol, new Color(color));
        cimSymbol.color = new Color(color); // not sure why but we need this too
      }
    }
  }

  toggleLayerVisibility(id: string) {
    this.layers.get(id)!.visible = !this.layers.get(id)?.visible;
  }

  deleteLayer(id: string) {
    this.removeLayerFromMap.next(id);
  }

  /* *************************** */
  /* Data ServiceLayer Ingesters */
  /* *************************** */

  async addVehiclePositionPointLayer(layer: RawDataLayer) {
    this.setInitialColor(layer.query);
    // setup layer
    // TODO do this in a separate function
    const newLayer = new FeatureLayer({
      fields: [
        {
          name: "ObjectID",
          alias: "ObjectID",
          type: "oid"
        },
        {
          name: "time",
          alias: "time",
          type: "date"
        },
        {
          name: "trip_id",
          alias: "trip_id",
          type: "string"
        },
        {
          name: "route_id",
          alias: "route_id",
          type: "string"
        },
        {
          name: "direction_id",
          alias: "direction_id",
          type: "string"
        },
        {
          name: "schedule_relationship",
          alias: "schedule_relationship",
          type: "string"
        },
        {
          name: "vehicle_id",
          alias: "vehicle_id",
          type: "string"
        },
        {
          name: "vehicle_label",
          alias: "vehicle_label",
          type: "string"
        },
        {
          name: "latitude",
          alias: "latitude",
          type: "double"
        },
        {
          name: "longitude",
          alias: "longitude",
          type: "double"
        },
        {
          name: "bearing",
          alias: "bearing",
          type: "double"
        },
        {
          name: "stop_id",
          alias: "stop_id",
          type: "string"
        },
        {
          name: "current_status",
          alias: "current_status",
          type: "string"
        }
      ],
      objectIdField: "ObjectID",
      id: layer.query.time.getTime().toString(), // id of layer is time of query
      outFields: ["*"],
      geometryType: "point",
      renderer: new SimpleRenderer({
        symbol: new SimpleMarkerSymbol({
          style: "circle",
          color: layer.query.color,
          size: "10px", // pixels
          outline: {
            // autocasts as new SimpleLineSymbol()
            color: [255, 255, 255],
            width: 1, // points
          }
        })
      }),
      popupTemplate: {
        title: "ID: {vehicle_id}",
        // content: popup_content_rt
      },
      source: []
    });

    // populate layer with data
    let data = layer.data.data as VehiclePositionPoint[];
    const graphics = data.map(x => {
      var point = {
        type: "point", // autocasts as new Polyline()
        latitude: x.latitude,
        longitude: x.longitude
      };
      var attributes;
      // this still exists because "supposedly" if the bus 
      // is not on a trip, its route_id, stop_id, and current_status are null
      if (x.trip_id === null || x.trip_id === undefined) {
        //console.log(locationObject);
        attributes = {
          time: new Date(x._time).getTime(),
          trip_id: x.trip_id,
          route_id: x.route_id,
          direction_id: x.direction_id,
          schedule_relationship: x.schedule_relationship,
          vehicle_id: x.vehicle_id,
          vehicle_label: x.vehicle_label,
          latitude: x.latitude,
          longitude: x.longitude,
          bearing: x.bearing,
          stop_id: x.stop_id,
          current_status: x.current_status,
          // route_id: "",
          // stop_id: "",
          // current_status: ""
        };
      } else {
        attributes = {
          time: new Date(x._time).getTime(),
          trip_id: x.trip_id,
          route_id: x.route_id,
          direction_id: x.direction_id,
          schedule_relationship: x.schedule_relationship,
          vehicle_id: x.vehicle_id,
          vehicle_label: x.vehicle_label,
          latitude: x.latitude,
          longitude: x.longitude,
          bearing: x.bearing,
          stop_id: x.stop_id,
          current_status: x.current_status,
        };
      }
      return new Graphic({
        geometry: point as GeometryProperties,
        attributes: attributes,
      });
    });
    // add graphics to layer
    await newLayer.applyEdits({ addFeatures: graphics });
    // save layer and tell map component to add the layer
    this.layers.set(newLayer.id, newLayer);
    this.addLayerToMap.next(newLayer.id);
  }

  /* ********************** */
  /* Static Layer Ingesters */
  /* ********************** */

  async addArcGISFeatureLayer(query: ArcGISFeatureQuery) {
    // create copy of static layer from query
    var newLayer: FeatureLayer = query.getFeatureLayer().clone();

    // set some properties
    this.setInitialColor(query);
    newLayer.id = query.time.getTime().toString();

    if (query.layerType = LayerType.Point) {
      var renderer: SimpleRenderer = new SimpleRenderer;
      const symbol = new WebStyleSymbol({
        name: query.getWebStyleSymbolName(),
        styleName: "Esri2DPointSymbolsStyle",
      });

      const cimSymbol = await symbol.fetchCIMSymbol();
      applyCIMSymbolColor(cimSymbol, new Color(query.color));
      renderer.symbol = cimSymbol;

      // TODO: figure out visual variables to scale symbols correctly
      // renderer.visualVariables = [
      //   {
      // type: "size",
      //     valueExpression: "$view.scale",
      // stops: [
      //   { size: 9, value: 1155581 },
      //   { size: 6, value: 9244648 },
      //   { size: 3, value: 73957190 },
      //   { size: 1.5, value: 591657527 }
      // ]
      // }] as SizeVariable[];
      newLayer.renderer = renderer;
    };

    // TODO: build where clause definition expression as a string
    // var defExpr = layer.whereClauses
    // newLayer.def

    // save layer here
    this.layers.set(newLayer.id, newLayer);

    // send query to layers component to display
    this.addLayerToLayersView.next(query);

    // tell map component to display layer on map
    this.addLayerToMap.next(newLayer.id);
  }
}
