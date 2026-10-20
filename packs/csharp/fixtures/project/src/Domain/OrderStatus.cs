namespace Shop.Domain
{
    public enum OrderStatus
    {
        Draft,
        Placed = 2,
    }

    public delegate void OrderPlaced(Order order);
}
