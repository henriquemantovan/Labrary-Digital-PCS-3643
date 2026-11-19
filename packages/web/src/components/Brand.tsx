import { Icon } from "../Icons";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Icon name="book" size={23} />
      </span>
      <span>
        labrary<span className="brand-sub">DIGITAL</span>
      </span>
    </span>
  );
}
