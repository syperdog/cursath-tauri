export interface DefectNode {
  id: number;
  name: string;
  description: string | null;
}

export interface DefectType {
  id: number;
  node_id: number;
  node_name: string;
  name: string;
  description: string | null;
}

export interface Defect {
  id: number;
  order_id: number;
  diagnostician_id: number;
  defect_description: string; // узел/неисправность
  diagnostician_comment: string | null; // детальное описание
  is_confirmed: boolean;
  defect_type_id: number | null;
}