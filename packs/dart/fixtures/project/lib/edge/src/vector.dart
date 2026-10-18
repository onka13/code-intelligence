class Vector {
  final double x, y;
  const Vector(this.x, this.y);
  Vector operator +(Vector o) => Vector(x + o.x, y + o.y);
}
