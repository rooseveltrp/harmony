const pick = require('lodash.pick');
const uuid = require('uuid');
const {
  linksWithStacData,
} = require('../util/stac');
const HarmonyJob = require('../models/job');

class HarmonyItem {
  /**
   *
   * @param {string} id - ID of the STAC Item
   * @param {string} title - Title of the STAC Item
   * @param {string} description - Description of the STAC Item
   */
  constructor(id = uuid.v4(), title = '', description = '') {
    this.id = id;
    this.stac_version = '0.9.0';
    this.title = title;
    this.description = description;
    this.type = 'Feature';
    this.bbox = [];
    this.geometry = {};
    this.properties = {};
    this.assets = {};
    this.links = [];
  }

  /**
   * Adds GeoJSON Feature to the STAC Item
   * In future, this should take a polygon and derive a bounding box.
   *
   * @param {number[]} bbox - GeoJSON bounding box
   * @returns {void}
   */
  addSpatialExtent(bbox) {
    // Validate bounding box; should compliant with GeoJSON spec
    if (bbox.length < 4) {
      throw new TypeError('Bounding box');
    }

    const west = bbox[0];
    const south = bbox[1];
    const east = bbox[2];
    const
      north = bbox[3];

    const geometry = {
      type: undefined,
      coordinates: [],
    };
    if (west > east) {
      // Case of bounding box crossing anti-meridian
      geometry.type = 'MultiPolygon';
      geometry.coordinates.push([
        [-180, south],
        [-180, north],
        [east, north],
        [east, south],
        [-180, south],
      ]);
      geometry.coordinates.push([
        [west, south],
        [west, north],
        [180, north],
        [180, south],
        [-180, south],
      ]);
    } else {
      geometry.type = 'Polygon';
      geometry.coordinates.push([
        [west, south],
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ]);
    }
    this.bbox = bbox;
    this.geometry = geometry;
  }

  /**
   * Adds links to a STAC Item
   *
   * @param {string} url - Link URL
   * @param {string} relType - Relation type: [self, root, item]
   * @param {string} title - Link title (human readable)
   *
   * @returns {void}
   */
  addLink(url, relType, title) {
    this.links.push({
      href: url,
      rel: relType,
      title,
    });
  }

  /**
   * Adds temporal properties for a STAC Item
   *
   * @param {string} start - Data start datetime
   * @param {string} end - Data end datetime
   *
   * @returns {void}
   */
  addTemporalExtent(start, end) {
    // Validate
    this.setProperty('start_datetime', start);
    this.setProperty('end_datetime', end);
    this.setProperty('datetime', start);
  }

  /**
   * Sets a property for a STAC Item
   * @param {string} name - Name of the property
   * @param {string} value - Value of the property
   *
   * @returns {void}
   */
  setProperty(name, value) {
    this.properties[name] = value;
  }

  /**
   *
   * Adds an asset to the STAC Item
   *
   * @param {string} href - Asset URL
   * @param {string} title - Asset title
   * @param {string} mimetype - Asset mimetype
   * @param {string} role - Asset role [thumbnail,overview,data,metadata]
   *
   * @returns {void}
   */
  addAsset(href, title, mimetype) {
    let role = 'data';
    // Determine the role based on mimetype
    const [type, subtype] = mimetype.split('/');
    if (type === 'application') {
      if (subtype === 'json') {
        // application/json
        role = 'metadata';
      } else {
        // application/nc, application/octet-stream ...
        role = 'data';
      }
    } else if (type === 'image') {
      // image/*
      role = 'overview';
    } else if (type === 'text') {
      if (subtype === 'xml') {
        // text/xml
        role = 'metadata';
      } else {
        // text/plain, text/csv, ...
        role = 'data';
      }
    }

    // Using href as the key for assets; STAC clients seem to attach special meaning
    // to some keys (ex: thumbnail)
    this.assets[href] = {
      href,
      title,
      type: mimetype,
      roles: [role],
    };
  }

  /**
   * Placeholder method to support custom stringification
   *
   * @returns {Object} - STAC item JSON
   */
  toJSON() {
    const paths = ['id', 'stac_version', 'title', 'description', 'type', 'bbox', 'geometry', 'properties', 'assets', 'links'];
    return pick(this, paths);
  }
}

/**
 * Function to create the STAC Catalog given a Harmony Job object
 *
 * @param {Job} job - Harmony Job object
 * @param {number} index - Index of the Link item in Job
 *
 * @returns {Object} - STAC Item JSON
 */
function create(job, index) {
  if (!(job instanceof HarmonyJob)) {
    throw new TypeError('Constructor accepts Harmony Job object as the first argument');
  }
  if (!Object.hasOwnProperty.call(job, 'jobID')) {
    throw new TypeError('Failed to find job ID');
  }
  if (!Object.hasOwnProperty.call(job, 'request')) {
    throw new TypeError('Failed to find request');
  }
  const title = `Harmony output #${index} in job ${job.jobID}`;
  const description = `Harmony out for ${job.request}`;
  const item = new HarmonyItem(job.jobID, title, description);

  // Set creation time
  const creationTime = Object.hasOwnProperty.call(job, 'createdAt') ? job.createdAt : new Date().toISOString();
  item.setProperty('created', creationTime);
  // TBD: may be it should be a metadata for a Harmony service
  item.setProperty('license', 'various');
  // Add assets
  const stacLinks = linksWithStacData(job.links);
  if (index < 0 || index >= stacLinks.length) {
    throw new RangeError('Error: STAC item index is out of bounds');
  }
  const {
    bbox,
    temporal,
    href,
    title: linkTitle,
    type,
  } = stacLinks[index];
  item.addSpatialExtent(bbox);
  item.addTemporalExtent(temporal.start, temporal.end);
  item.addAsset(href, linkTitle, type);

  item.addLink('../', 'self', 'self');
  item.addLink('../', 'root', 'parent');
  return item.toJSON();
}

module.exports.create = create;