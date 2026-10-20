namespace Shop.Domain;

/// <summary>An order and its lines.</summary>
[Serializable]
public sealed class Order : Entity, IComparable<Order>
{
    private readonly List<decimal> _lines = new();
    internal const int MaxLines = 100;

    public Order(string id)
    {
        Id = id;
    }

    public string Id { get; }

    public OrderStatus Status { get; private set; } = OrderStatus.Draft;

    public decimal Total => _lines.Sum();

    public void AddLine(decimal amount)
    {
        if (_lines.Count >= MaxLines) throw new InvalidOperationException("Too many lines.");
        _lines.Add(amount);
    }

    public int CompareTo(Order? other) => string.CompareOrdinal(Id, other?.Id);

    protected virtual void OnPlaced() { }

    private static bool IsValid(decimal amount) => amount > 0;
}

public abstract class Entity;

public record Money(decimal Amount, string Currency);

public interface IOrderRepository
{
    Task<Order?> FindAsync(string id, CancellationToken cancellationToken);

    int Count { get; }
}
