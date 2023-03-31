import { ClauseNode, WhereClause } from "./where-clauses";

export abstract class Query {
    time: Date = new Date();
    visible: boolean = true;
    color: string;
    whereClauses: ClauseNode = new ClauseNode();
    abstract type: QueryType;
    abstract name: string;
    abstract view(): string;
    get id(): string { return this.time.getTime().toString() };
}

export enum QueryType {
    VehiclePosition = "Vehicle Position"
}

export type Attributes = { [key: string]: Attribute }

export interface Attribute {
    name: string;
    type: string;
    possibleValues: { [key: string]: string }
}